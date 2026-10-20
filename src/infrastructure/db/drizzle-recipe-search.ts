import 'server-only';
import {
	and,
	arrayContains,
	arrayOverlaps,
	count,
	desc,
	eq,
	gt,
	inArray,
	isNotNull,
	lte,
	or,
	sql,
	type SQL,
} from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type {
	HighlightedText,
	RecipeAddedWithin,
	RecipeContributorCount,
	RecipeFacetCount,
	RecipeMatch,
	RecipeSearch,
	RecipeSearchFacets,
	RecipeSearchHit,
	RecipeSearchQuery,
	RecipeSearchResults,
	RecipeSearchSort,
	RecipeTextQuery,
} from '@/application/ports/recipe-search';
import { memberIdSchema, type MemberId } from '@/domain/member/member';
import { chapters } from '@/domain/recipe/chapter';
import { diets } from '@/domain/recipe/diet';
import { holidays } from '@/domain/recipe/holiday';
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

const addedWithinIntervals: Record<RecipeAddedWithin, SQL> = {
	week: sql`interval '1 week'`,
	month: sql`interval '1 month'`,
	year: sql`interval '1 year'`,
};

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
	addedWithin?: SQL;
};
type SearchFilter = keyof SearchFilters;

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

function searchFilters(query: RecipeSearchQuery): SearchFilters {
	return {
		chapter: query.chapter === undefined ? undefined : eq(recipes.chapter, query.chapter),
		holidays:
			query.holidays.length === 0 ? undefined : arrayOverlaps(recipes.holidays, query.holidays),
		diets: query.diets.length === 0 ? undefined : arrayContains(recipes.diets, query.diets),
		source:
			query.source === undefined
				? undefined
				: sql`${recipes.sourceKey} = public.search_key(${query.source})`,
		contributor:
			query.contributorId === undefined
				? undefined
				: eq(recipes.contributorId, query.contributorId),
		maxTotalMinutes:
			query.maxTotalMinutes === undefined
				? undefined
				: lte(recipes.totalMinutes, query.maxTotalMinutes),
		addedWithin:
			query.addedWithin === undefined
				? undefined
				: sql`${recipes.createdAt} >= now() - ${addedWithinIntervals[query.addedWithin]}`,
	};
}

// The recipes the text and every filter match, or every filter but the one a facet counts without.
function matchingExcept(
	match: TextMatch,
	filters: SearchFilters,
	except?: SearchFilter
): SQL | undefined {
	const kept = Object.entries(filters)
		.filter(([name]) => name !== except)
		.map(([, filter]) => filter);
	return and(match.condition, ...kept);
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

	async search(query: RecipeSearchQuery): Promise<RecipeSearchResults> {
		const filters = searchFilters(query);
		const exact = exactMatch(query.text);
		const total = await this.db.$count(recipes, matchingExcept(exact, filters));

		if (total === 0 && query.text !== undefined && query.text.includedWords.length > 0) {
			const close = closeMatch(query.text);
			const closeTotal = await this.db.$count(recipes, matchingExcept(close, filters));
			if (closeTotal > 0) {
				return this.findResults(query, close, filters, closeTotal);
			}
		}

		return this.findResults(query, exact, filters, total);
	}

	private async findResults(
		query: RecipeSearchQuery,
		match: TextMatch,
		filters: SearchFilters,
		total: number
	): Promise<RecipeSearchResults> {
		const [hits, vocabularies, sources, contributors] = await Promise.all([
			this.findHits(query, match, filters),
			this.countVocabularies(match, filters),
			this.countSources(match, filters),
			this.countContributors(match, filters, query.contributorId),
		]);
		return {
			hits,
			total,
			match: match.kind,
			facets: { ...vocabularies, sources, contributors },
		};
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
			.where(matchingExcept(match, filters))
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

	// Chapters and holidays count with every filter but their own, and diets within the results, since a
	// recipe must suit every diet chosen.
	private async countVocabularies(
		match: TextMatch,
		filters: SearchFilters
	): Promise<Pick<RecipeSearchFacets, 'chapters' | 'holidays' | 'diets'>> {
		const [chapterCounts, holidayCounts, dietCounts] = await Promise.all([
			this.countEach(
				chapters,
				(chapter) => eq(recipes.chapter, chapter),
				matchingExcept(match, filters, 'chapter')
			),
			this.countEach(
				holidays,
				(holiday) => arrayContains(recipes.holidays, [holiday]),
				matchingExcept(match, filters, 'holidays')
			),
			this.countEach(
				diets,
				(diet) => arrayContains(recipes.diets, [diet]),
				matchingExcept(match, filters)
			),
		]);
		return { chapters: chapterCounts, holidays: holidayCounts, diets: dietCounts };
	}

	// Each member of the vocabulary counted among the recipes the condition keeps, even at zero.
	private async countEach<Value extends string>(
		vocabulary: readonly Value[],
		filedUnder: (value: Value) => SQL,
		condition: SQL | undefined
	): Promise<Record<Value, number>> {
		const counts = vocabulary.map((value) => sql`count(*) filter (where ${filedUnder(value)})`);
		// An aggregate without grouping always returns its one row.
		const [row] = await this.db
			.select({ counts: sql<number[]>`array[${sql.join(counts, sql`, `)}]::integer[]` })
			.from(recipes)
			.where(condition);
		return Object.fromEntries(
			vocabulary.map((value, index) => [value, row?.counts[index] ?? 0])
		) as Record<Value, number>;
	}

	// The earliest recipe's spelling labels each source, most used first and then by key, the source
	// ignoring case.
	private async countSources(
		match: TextMatch,
		filters: SearchFilters
	): Promise<RecipeFacetCount[]> {
		return this.db
			.select({
				label: sql<string>`(array_agg(${recipes.content} ->> 'source' order by ${recipes.createdAt}, ${recipes.id}))[1]`,
				count: count(),
			})
			.from(recipes)
			.where(and(matchingExcept(match, filters, 'source'), isNotNull(recipes.sourceKey)))
			.groupBy(recipes.sourceKey)
			.orderBy(desc(count()), recipes.sourceKey);
	}

	// Counted from members, so the chosen one is listed even with no result left: a URL holds only
	// the id, and the filters need the name. Ordered as sources are, by count and then name.
	private async countContributors(
		match: TextMatch,
		filters: SearchFilters,
		chosen: MemberId | undefined
	): Promise<RecipeContributorCount[]> {
		const recipeCount = count(recipes.id);
		const rows = await this.db
			.select({ memberId: users.id, displayName: users.displayName, count: recipeCount })
			.from(users)
			.leftJoin(
				recipes,
				and(eq(recipes.contributorId, users.id), matchingExcept(match, filters, 'contributor'))
			)
			.groupBy(users.id)
			.having(or(gt(recipeCount, 0), chosen === undefined ? undefined : eq(users.id, chosen)))
			.orderBy(desc(recipeCount), sql`public.search_key(${users.displayName})`, users.id);
		return rows.map((row) => ({ ...row, memberId: memberIdSchema.parse(row.memberId) }));
	}
}
