import 'server-only';
import {
	and,
	arrayContains,
	arrayOverlaps,
	count,
	desc,
	eq,
	exists,
	gt,
	inArray,
	isNotNull,
	lte,
	notExists,
	or,
	sql,
	type SQL,
	type SQLWrapper,
} from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import {
	recipeTotalTimeChoices,
	type HighlightedText,
	type RecipeContributorCount,
	type RecipeCountQuery,
	type RecipeCounts,
	type RecipeFacetCount,
	type RecipeMatch,
	type RecipeSearch,
	type RecipeSearchFacets,
	type RecipeSearchHit,
	type RecipeSearchQuery,
	type RecipeSearchResults,
	type RecipeSearchSort,
	type RecipeTextQuery,
	type RecipeTotalTimeChoice,
} from '@/application/ports/recipe-search';
import { memberIdSchema, type MemberId } from '@/domain/member/member';
import { chapters, type Chapter } from '@/domain/recipe/chapter';
import { diets, type Diet } from '@/domain/recipe/diet';
import { holidays, type Holiday } from '@/domain/recipe/holiday';
import type { Recipe } from '@/domain/recipe/recipe';
import { recipeColumns, toRecipe } from '@/infrastructure/db/recipe-mapper';
import { recipeOrders } from '@/infrastructure/db/recipe-order';
import { recipes, recipeSearchConfiguration, users } from '@/infrastructure/db/schema';
import {
	hasMatch,
	passageHeadlineOptions,
	plainText,
	titleHeadlineOptions,
	toHighlightedText,
	toSnippet,
} from '@/infrastructure/db/search-headline';

// Below pg_trgm's default of 0.6, which misses a one-letter slip in a short word ("chiken" scores 0.5).
const closeMatchSimilarity = 0.5;

// The one row the choice of match answers, which each driver returns under rows.
const closeMatchResultSchema = z.object({ rows: z.tuple([z.object({ close: z.boolean() })]) });

// How recipes match the text, how they rank by relevance, and the query that marks matches.
type TextMatch = {
	kind: RecipeMatch;
	condition?: SQL;
	relevance?: SQL;
	highlightQuery?: SQL;
};

// Kept apart, so a facet can count with every filter but its own.
type SearchFilters = {
	chapter?: SQL;
	holidays?: SQL;
	diets?: SQL;
	source?: SQL;
	contributor?: SQL;
	maxTotalMinutes?: SQL;
};
type SearchFilter = keyof SearchFilters;

// The condition each filter adds, so a facet counts an option by the filter that choosing it adds.
const filterConditions = {
	chapter: (chapter: Chapter) => eq(recipes.chapter, chapter),
	// A recipe for any one of them.
	holidays: (chosen: Holiday[]) => arrayOverlaps(recipes.holidays, chosen),
	// A recipe that suits every one.
	diets: (chosen: Diet[]) => arrayContains(recipes.diets, chosen),
	source: (source: string) => sql`${recipes.sourceKey} = public.search_key(${source})`,
	contributor: (memberId: MemberId) => eq(recipes.contributorId, memberId),
	maxTotalMinutes: (minutes: RecipeTotalTimeChoice) => lte(recipes.totalMinutes, minutes),
} satisfies Record<SearchFilter, (value: never) => SQL>;

// A field a snippet can come from, with its headline for the text query.
type Passage = {
	text: string | null;
	headline: string | null;
};

function joinedText(path: string, separator: string): SQL<string | null> {
	return sql`(select string_agg(item, ${separator} order by position) from jsonb_array_elements_text(jsonb_path_query_array(${recipes.content}, ${path})) with ordinality as items(item, position))`;
}

const titleText = sql<string>`${recipes.content} ->> 'title'`;
const descriptionText = sql<string | null>`${recipes.content} ->> 'description'`;
const ingredientsText = joinedText('$.ingredientSections[*].lines[*].text', ' · ');
const notesText = sql<string | null>`${recipes.content} ->> 'notes'`;
const stepsText = joinedText('$.instructionSections[*].steps[*].text', ' ');

function headline(text: SQL, query: SQL, options: string): SQL<string | null> {
	return sql`ts_headline(${recipeSearchConfiguration}, ${text}, ${query}, ${options})`;
}

function passage(text: SQL<string | null>, query: SQL) {
	return { text, headline: headline(text, query, passageHeadlineOptions) };
}

function exactMatch(text: RecipeTextQuery | undefined): TextMatch {
	if (text === undefined) {
		return { kind: 'exact' };
	}

	const query = sql`websearch_to_tsquery(${recipeSearchConfiguration}, ${text.text})`;
	// querytree drops negated words, which would otherwise rank and highlight; '' or 'T' leaves none.
	const indexedQuery = sql`nullif(nullif(querytree(${query}), ''), 'T')::tsquery`;
	// An or beside an exclusion ("chicken or -salt") leaves querytree nothing, so the included words rank.
	const positiveQuery =
		text.includedWords.length === 0
			? indexedQuery
			: sql`coalesce(${indexedQuery}, nullif(websearch_to_tsquery(${recipeSearchConfiguration}, ${text.includedWords.join(' or ')})::text, '')::tsquery)`;
	return {
		kind: 'exact',
		// A query of stop words alone has no lexemes, so it filters nothing.
		condition: sql`(numnode(${query}) = 0 or ${recipes.searchVector} @@ ${query})`,
		relevance: sql`ts_rank_cd(${recipes.searchVector}, ${positiveQuery})`,
		highlightQuery: positiveQuery,
	};
}

function closeMatch(text: RecipeTextQuery): TextMatch {
	const words = sql`lower(public.immutable_unaccent(${text.includedWords.join(' ')}))`;
	const similarity = sql`word_similarity(${words}, ${recipes.searchWords})`;
	const excluded =
		text.excludedTerms.length === 0
			? undefined
			: sql`not (${recipes.searchVector} @@ websearch_to_tsquery(${recipeSearchConfiguration}, ${text.excludedTerms.join(' or ')}))`;
	return {
		kind: 'close',
		condition: and(sql`${similarity} >= ${closeMatchSimilarity}`, excluded),
		relevance: similarity,
	};
}

function searchFilters(query: RecipeCountQuery): SearchFilters {
	return {
		chapter: query.chapter === undefined ? undefined : filterConditions.chapter(query.chapter),
		holidays: query.holidays.length === 0 ? undefined : filterConditions.holidays(query.holidays),
		diets: query.diets.length === 0 ? undefined : filterConditions.diets(query.diets),
		source: query.source === undefined ? undefined : filterConditions.source(query.source),
		contributor:
			query.contributorId === undefined
				? undefined
				: filterConditions.contributor(query.contributorId),
		maxTotalMinutes:
			query.maxTotalMinutes === undefined
				? undefined
				: filterConditions.maxTotalMinutes(query.maxTotalMinutes),
	};
}

// Every filter, or every filter but the one a facet counts without.
function filtersExcept(filters: SearchFilters, except?: SearchFilter): SQL | undefined {
	const kept = Object.entries(filters)
		.filter(([name]) => name !== except)
		.map(([, filter]) => filter);
	return and(...kept);
}

// Counts recipes rather than rows, so a member joined to none counts zero.
function countWhere(condition: SQL | undefined): SQL<number> {
	return condition === undefined
		? count(recipes.id)
		: sql`${count(recipes.id)} filter (where ${condition})`.mapWith(Number);
}

// Each member of the vocabulary counted where the filter choosing it would keep, in its order.
function countEach<Value>(
	vocabulary: readonly Value[],
	filedUnder: (value: Value) => SQL,
	kept: SQL | undefined
): SQL<number[]> {
	const counts = vocabulary.map((value) => countWhere(and(filedUnder(value), kept)));
	return sql<number[]>`array[${sql.join(counts, sql`, `)}]::integer[]`;
}

// A key that already ignores case, ordered as titles are, so a name that starts with an accented
// letter sits among the names that start with the letter.
function byName(key: SQL | SQLWrapper): SQL {
	return sql`public.immutable_unaccent(${key})`;
}

// Pairs each member of the vocabulary with its count, as countEach lists them.
function byMember<Value extends PropertyKey>(
	vocabulary: readonly Value[],
	counts: readonly number[]
): Record<Value, number> {
	return Object.fromEntries(
		vocabulary.map((value, index) => [value, counts[index] ?? 0])
	) as Record<Value, number>;
}

function searchOrder(match: TextMatch, sort: RecipeSearchSort): SQL[] {
	if (sort !== 'relevance') {
		return recipeOrders[sort];
	}

	// Without text to rank by, relevance lists the newest first.
	return match.relevance === undefined
		? recipeOrders.newest
		: [desc(match.relevance), ...recipeOrders.newest];
}

function descriptionSnippet(recipe: Recipe): HighlightedText | undefined {
	return recipe.description === undefined ? undefined : plainText(recipe.description);
}

function plainHit(recipe: Recipe): RecipeSearchHit {
	return { recipe, title: plainText(recipe.title), snippet: descriptionSnippet(recipe) };
}

// The snippet comes from the first passage that matched, in the order given.
function highlightedHit(
	recipe: Recipe,
	title: string | null,
	passages: Passage[]
): RecipeSearchHit {
	const matched = passages.find(
		(passage): passage is { text: string; headline: string } =>
			passage.text !== null && passage.headline !== null && hasMatch(passage.headline)
	);
	return {
		recipe,
		title: title === null ? plainText(recipe.title) : toHighlightedText(title),
		snippet:
			matched === undefined
				? descriptionSnippet(recipe)
				: toSnippet(matched.headline, matched.text),
	};
}

export class DrizzleRecipeSearch implements RecipeSearch {
	private readonly db: PgDatabase<PgQueryResultHKT>;

	constructor(db: PgDatabase<PgQueryResultHKT>) {
		this.db = db;
	}

	// Two stages: the match, chosen only when there are words, then the page of hits beside the counts.
	async search(query: RecipeSearchQuery): Promise<RecipeSearchResults> {
		const match = await this.chooseMatch(query.text);
		const filters = searchFilters(query);
		const [hits, { total, facets }] = await Promise.all([
			this.findHits(query, match, filters),
			this.countFacets(match, filters, query.contributorId),
		]);
		return { hits, total, match: match.kind, facets };
	}

	// Search's two stages without the page of hits: the match, then the counts alone.
	async count(query: RecipeCountQuery): Promise<RecipeCounts> {
		const match = await this.chooseMatch(query.text);
		return this.countFacets(match, searchFilters(query), query.contributorId);
	}

	// From the words alone, before the filters, so every count is what applying its option shows.
	private async chooseMatch(text: RecipeTextQuery | undefined): Promise<TextMatch> {
		const exact = exactMatch(text);
		// Close matches compare the included words, so without any the exact match stands.
		if (text === undefined || text.includedWords.length === 0) {
			return exact;
		}

		const close = closeMatch(text);
		const matching = (match: TextMatch) =>
			this.db.select({ id: recipes.id }).from(recipes).where(match.condition);
		// Postgres looks for a close match only when no exact one turns up. With neither, the empty
		// exact result stands.
		const result = await this.db.execute(
			sql`select ${notExists(matching(exact))} and ${exists(matching(close))} as close`
		);
		const [{ close: closeOnly }] = closeMatchResultSchema.parse(result).rows;
		return closeOnly ? close : exact;
	}

	private async findHits(
		query: RecipeSearchQuery,
		match: TextMatch,
		filters: SearchFilters
	): Promise<RecipeSearchHit[]> {
		const order = searchOrder(match, query.sort);
		// Selected apart, so headlines run for the page's rows only.
		const page = this.db
			.select({ id: recipes.id })
			.from(recipes)
			.where(and(match.condition, filtersExcept(filters)))
			.orderBy(...order)
			.limit(query.limit)
			.offset(query.offset);

		const highlightQuery = match.highlightQuery;
		if (highlightQuery === undefined) {
			const rows = await this.db
				.select(recipeColumns)
				.from(recipes)
				.where(inArray(recipes.id, page))
				.orderBy(...order);
			return rows.map((row) => plainHit(toRecipe(row)));
		}

		const rows = await this.db
			.select({
				...recipeColumns,
				title: headline(titleText, highlightQuery, titleHeadlineOptions),
				description: passage(descriptionText, highlightQuery),
				ingredients: passage(ingredientsText, highlightQuery),
				notes: passage(notesText, highlightQuery),
				steps: passage(stepsText, highlightQuery),
			})
			.from(recipes)
			.where(inArray(recipes.id, page))
			.orderBy(...order);
		return rows.map(({ title, description, ingredients, notes, steps, ...row }) =>
			highlightedHit(toRecipe(row), title, [description, ingredients, notes, steps])
		);
	}

	// The total and every facet, from the aggregate row and the two groupings run at once.
	private async countFacets(
		match: TextMatch,
		filters: SearchFilters,
		chosenContributor: MemberId | undefined
	): Promise<RecipeCounts> {
		const [{ total, ...vocabularies }, sources, contributors] = await Promise.all([
			this.countVocabularies(match, filters),
			this.countSources(match, filters),
			this.countContributors(match, filters, chosenContributor),
		]);
		return { total, facets: { ...vocabularies, sources, contributors } };
	}

	// One row over the recipes the words match: the total, then every vocabulary's member counted with
	// every filter but its group's, and diets within the results, since a recipe must suit every diet
	// chosen.
	private async countVocabularies(
		match: TextMatch,
		filters: SearchFilters
	): Promise<{ total: number } & Omit<RecipeSearchFacets, 'sources' | 'contributors'>> {
		const kept = (except?: SearchFilter) => filtersExcept(filters, except);
		const [row] = await this.db
			.select({
				total: countWhere(kept()),
				allRecipes: countWhere(kept('chapter')),
				chapters: countEach(chapters, filterConditions.chapter, kept('chapter')),
				holidays: countEach(
					holidays,
					(holiday) => filterConditions.holidays([holiday]),
					kept('holidays')
				),
				diets: countEach(diets, (diet) => filterConditions.diets([diet]), kept()),
				totalTimes: countEach(
					recipeTotalTimeChoices,
					filterConditions.maxTotalMinutes,
					kept('maxTotalMinutes')
				),
			})
			.from(recipes)
			.where(match.condition);
		// An aggregate without grouping always returns its one row.
		const counts = row!;
		return {
			total: counts.total,
			allRecipes: counts.allRecipes,
			chapters: byMember(chapters, counts.chapters),
			holidays: byMember(holidays, counts.holidays),
			diets: byMember(diets, counts.diets),
			totalTimes: byMember(recipeTotalTimeChoices, counts.totalTimes),
		};
	}

	// Every source among the recipes the words match, counted with every filter but the source. The
	// earliest recipe's spelling labels each, in order of its key, the source ignoring case.
	private async countSources(
		match: TextMatch,
		filters: SearchFilters
	): Promise<RecipeFacetCount[]> {
		const recipeCount = countWhere(filtersExcept(filters, 'source'));
		return this.db
			.select({
				label: sql<string>`(array_agg(${recipes.content} ->> 'source' order by ${recipes.createdAt}, ${recipes.id}))[1]`,
				count: recipeCount,
			})
			.from(recipes)
			.where(and(match.condition, isNotNull(recipes.sourceKey)))
			.groupBy(recipes.sourceKey)
			.orderBy(byName(recipes.sourceKey), recipes.sourceKey);
	}

	// Every member with a recipe the words match, counted with every filter but the contributor. Counted
	// from members, so the chosen one is listed even with none: a URL holds only the id, and the filters
	// need the name. Ordered by name as sources are by key, and then by id.
	private async countContributors(
		match: TextMatch,
		filters: SearchFilters,
		chosen: MemberId | undefined
	): Promise<RecipeContributorCount[]> {
		const recipeCount = countWhere(filtersExcept(filters, 'contributor'));
		const rows = await this.db
			.select({ memberId: users.id, displayName: users.displayName, count: recipeCount })
			.from(users)
			.leftJoin(recipes, and(eq(recipes.contributorId, users.id), match.condition))
			.groupBy(users.id)
			.having(or(gt(count(recipes.id), 0), chosen === undefined ? undefined : eq(users.id, chosen)))
			.orderBy(byName(sql`public.search_key(${users.displayName})`), users.id);
		return rows.map((row) => ({ ...row, memberId: memberIdSchema.parse(row.memberId) }));
	}
}
