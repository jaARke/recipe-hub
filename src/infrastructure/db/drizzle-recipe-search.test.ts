import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NewMember } from '@/application/ports/member-repository';
import {
	recipeTotalTimeChoices,
	type HighlightedText,
	type RecipeSearchFacets,
	type RecipeSearchQuery,
	type RecipeSearchResults,
	type RecipeTextQuery,
} from '@/application/ports/recipe-search';
import { noRecipeSearchFacets } from '@/application/testing/fixed-recipe-search';
import { memberIdSchema, type MemberId } from '@/domain/member/member';
import { chapters, type Chapter } from '@/domain/recipe/chapter';
import { diets, type Diet } from '@/domain/recipe/diet';
import type { RecipeTimes } from '@/domain/recipe/duration';
import { holidays, type Holiday } from '@/domain/recipe/holiday';
import type { IngredientLine } from '@/domain/recipe/ingredient';
import { recipeContentSchema, type RecipeContentInput } from '@/domain/recipe/recipe';
import { slugify } from '@/domain/recipe/slug';
import { DrizzleMemberRepository } from '@/infrastructure/db/drizzle-member-repository';
import { DrizzleRecipeRepository } from '@/infrastructure/db/drizzle-recipe-repository';
import { DrizzleRecipeSearch } from '@/infrastructure/db/drizzle-recipe-search';
import { recipes } from '@/infrastructure/db/schema';
import { createTestDatabase, type TestDatabase } from '@/infrastructure/db/testing/test-database';

// Robin joins first, so only the name puts Robin after Contributor in the contributor facet. Ada
// adds no recipes, and the accent on her name's first letter sorts as the letter.
const members = {
	robin: { email: 'robin@example.com', displayName: 'Robin', role: 'member' },
	contributor: { email: 'contributor@example.com', displayName: 'Contributor', role: 'member' },
	ada: { email: 'ada@example.com', displayName: 'Áda', role: 'member' },
} satisfies Record<string, NewMember>;
type MemberName = keyof typeof members;

const unknownMemberId = memberIdSchema.parse('0199c7a4-2c3e-7b1a-9f00-2a7c1e4b5d6e');
const dayInMilliseconds = 24 * 60 * 60 * 1000;

type Fixture = {
	title: string;
	daysAgo: number;
	chapter: Chapter;
	holidays?: Holiday[];
	diets?: Diet[];
	// The contributor unless given.
	addedBy?: MemberName;
	description?: string;
	notes?: string;
	source?: string;
	lines?: Pick<IngredientLine, 'text' | 'item'>[];
	steps?: string[];
	times?: RecipeTimes;
};

// Listed oldest first. Recipes whose text matters to a test spell it out; the rest stay terse.
const fixtures: Fixture[] = [
	{
		title: 'Chicken pot pie',
		daysAgo: 400,
		chapter: 'main-dishes',
		source: 'Grandma Rose',
		lines: [
			{ text: '1 pound chicken thighs', item: 'chicken thighs' },
			{ text: '1 cup frozen peas', item: 'frozen peas' },
		],
		times: { totalMinutes: 90 },
	},
	{
		title: 'Sunday pot roast',
		daysAgo: 100,
		chapter: 'main-dishes',
		holidays: ['christmas'],
		diets: ['gluten-free', 'dairy-free'],
		description: 'A slow braise for a cold weekend.',
		source: 'Aunt June',
		lines: [
			{ text: '3 pounds chuck roast', item: 'chuck roast' },
			{ text: '4 carrots, cut in chunks', item: 'carrots' },
		],
		times: { prepMinutes: 20, cookMinutes: 240 },
	},
	{
		title: 'Roasted carrots',
		daysAgo: 90,
		chapter: 'vegetables-sides',
		holidays: ['thanksgiving'],
		diets: ['vegetarian', 'vegan', 'gluten-free', 'dairy-free'],
		lines: [{ text: '1 pound carrots', item: 'carrots' }],
		steps: ['Warm the pot, then roast the carrots until browned.'],
	},
	{
		title: 'Chicken noodle soup',
		daysAgo: 60,
		chapter: 'soups-salads',
		diets: ['dairy-free'],
		addedBy: 'robin',
		source: 'Grandpa Lou',
		lines: [
			{ text: '2 cups chicken, shredded', item: 'chicken' },
			{ text: '4 ounces egg noodles', item: 'egg noodles' },
			{ text: '2 carrots, sliced', item: 'carrots' },
		],
		times: { prepMinutes: 15, cookMinutes: 35 },
	},
	{
		title: 'Chicken and rice soup',
		daysAgo: 50,
		chapter: 'soups-salads',
		diets: ['gluten-free', 'dairy-free'],
		source: 'Grandpa Lou',
		lines: [
			{ text: '2 cups chicken, shredded', item: 'chicken' },
			{ text: '1 cup rice', item: 'rice' },
		],
	},
	{
		title: 'Tomato soup',
		daysAgo: 40,
		chapter: 'soups-salads',
		diets: ['vegetarian', 'gluten-free'],
		addedBy: 'robin',
		description: 'Bright and quick, with a swirl of cream.',
		lines: [
			{ text: '2 cans whole tomatoes', item: 'whole tomatoes' },
			{ text: '½ cup heavy cream', item: 'heavy cream' },
		],
		times: { totalMinutes: 30 },
	},
	{
		title: 'Buttermilk biscuits',
		daysAgo: 30,
		chapter: 'breads-rolls',
		holidays: ['christmas'],
		diets: ['vegetarian'],
		description: 'Tall and flaky, from cold butter and a gentle hand.',
		notes: 'Cut them with a juice glass and never twist it.',
		lines: [
			{ text: '2½ cups all-purpose flour', item: 'all-purpose flour' },
			{ text: '10 tablespoons cold unsalted butter, cubed', item: 'cold unsalted butter' },
			{ text: '1 cup cold buttermilk', item: 'cold buttermilk' },
		],
		steps: [
			'Heat the oven to 450°F and line a baking sheet with parchment.',
			'Whisk the flour, baking powder, salt, and baking soda in a large bowl.',
			'Rub the butter into the flour with your fingertips until the pieces are the size of peas.',
			'Stir in the buttermilk with a fork until a shaggy dough forms.',
			'Pat the dough out, fold it in thirds, and cut rounds.',
			'Bake them for 15 to 18 minutes until they turn deep golden.',
		],
		times: { prepMinutes: 15, cookMinutes: 18, totalMinutes: 35 },
	},
	{
		title: 'Rice bowl',
		daysAgo: 20,
		chapter: 'main-dishes',
		diets: ['dairy-free'],
		addedBy: 'robin',
		description: 'A weeknight bowl built on leftovers.',
		source: 'grandma rose',
		lines: [
			{ text: '2 cups cooked rice', item: 'cooked rice' },
			{ text: '2 scallions, thinly sliced', item: 'scallions' },
		],
		steps: ['Warm the rice.', 'Add the chicken and toss with the scallions.'],
		times: { prepMinutes: 10, cookMinutes: 15 },
	},
	{
		title: 'Skillet <b>scones</b>',
		daysAgo: 10,
		chapter: 'breads-rolls',
		holidays: ['easter'],
		diets: ['vegetarian'],
		description: 'Bake the <i>scones</i> in a hot skillet.',
	},
	{
		title: 'Crème brûlée',
		daysAgo: 3,
		chapter: 'desserts',
		holidays: ['christmas'],
		diets: ['vegetarian', 'gluten-free'],
		description: 'A custard under a crackly sugar top.',
		times: { totalMinutes: 300 },
	},
	{
		title: 'Creme caramel',
		daysAgo: 2,
		chapter: 'desserts',
		holidays: ['easter'],
		diets: ['vegetarian', 'gluten-free'],
		description: 'A custard that turns out of its dish.',
	},
];

function toContent(fixture: Fixture): RecipeContentInput {
	return {
		title: fixture.title,
		description: fixture.description,
		notes: fixture.notes,
		source: fixture.source,
		times: fixture.times ?? {},
		ingredientSections: [{ lines: fixture.lines ?? [{ text: '1 pinch salt', item: 'salt' }] }],
		instructionSections: [
			{ steps: (fixture.steps ?? ['Mix everything together.']).map((text) => ({ text })) },
		],
		chapter: fixture.chapter,
		holidays: fixture.holidays ?? [],
		diets: fixture.diets ?? [],
		images: [],
	};
}

// The searches share one database, since none of them writes.
let db: TestDatabase;
let search: DrizzleRecipeSearch;
let memberIds: Record<MemberName, MemberId>;

beforeAll(async () => {
	db = await createTestDatabase();
	search = new DrizzleRecipeSearch(db);
	const memberRepository = new DrizzleMemberRepository(db);
	memberIds = {
		robin: (await memberRepository.create(members.robin)).id,
		contributor: (await memberRepository.create(members.contributor)).id,
		ada: (await memberRepository.create(members.ada)).id,
	};
	const repository = new DrizzleRecipeRepository(db);
	for (const fixture of fixtures) {
		const content = recipeContentSchema.parse(toContent(fixture));
		const created = await repository.create({
			content,
			provenance: { entryMode: 'manual' },
			contributorId: memberIds[fixture.addedBy ?? 'contributor'],
			slugBase: slugify(content.title),
		});
		const createdAt = new Date(Date.now() - fixture.daysAgo * dayInMilliseconds);
		await db
			.update(recipes)
			.set({ createdAt, updatedAt: createdAt })
			.where(eq(recipes.id, created.id));
	}
});

afterAll(async () => {
	await db.$client.close();
});

function textQuery(
	text: string,
	includedWords: string[],
	excludedTerms: string[] = []
): RecipeTextQuery {
	return { text, includedWords, excludedTerms };
}

type SearchOptions = Partial<Omit<RecipeSearchQuery, 'text'>>;

function searchFor(
	text: RecipeTextQuery | undefined,
	options: SearchOptions = {}
): Promise<RecipeSearchResults> {
	return search.search({
		text,
		holidays: [],
		diets: [],
		sort: 'relevance',
		limit: 24,
		offset: 0,
		...options,
	});
}

function titles(results: RecipeSearchResults): string[] {
	return results.hits.map((hit) => hit.recipe.title);
}

function highlighted(text: HighlightedText | undefined): string[] {
	return (text ?? []).filter((segment) => segment.highlighted).map((segment) => segment.text);
}

function joined(text: HighlightedText | undefined): string {
	return (text ?? []).map((segment) => segment.text).join('');
}

type FacetOption = {
	name: string;
	count: number;
	applied: SearchOptions;
};

// Every option the facets offer, with its count and the filters that choosing it leaves. Holidays
// are any of those chosen, so a holiday's count is what it gives with no other holiday chosen.
function facetOptions(facets: RecipeSearchFacets, chosen: SearchOptions): FacetOption[] {
	return [
		{ name: 'All Recipes', count: facets.allRecipes, applied: { ...chosen, chapter: undefined } },
		...chapters.map((chapter) => ({
			name: chapter,
			count: facets.chapters[chapter],
			applied: { ...chosen, chapter },
		})),
		...holidays.map((holiday) => ({
			name: holiday,
			count: facets.holidays[holiday],
			applied: { ...chosen, holidays: [holiday] },
		})),
		...diets.map((diet) => ({
			name: diet,
			count: facets.diets[diet],
			applied: { ...chosen, diets: [...new Set([...(chosen.diets ?? []), diet])] },
		})),
		...recipeTotalTimeChoices.map((minutes) => ({
			name: `${minutes} minutes or less`,
			count: facets.totalTimes[minutes],
			applied: { ...chosen, maxTotalMinutes: minutes },
		})),
		...facets.sources.map(({ label, count }) => ({
			name: `from ${label}`,
			count,
			applied: { ...chosen, source: label },
		})),
		...facets.contributors.map(({ memberId, displayName, count }) => ({
			name: `added by ${displayName}`,
			count,
			applied: { ...chosen, contributorId: memberId },
		})),
	];
}

describe('matching text', () => {
	it('ranks a title match above matches in the body', async () => {
		const carrots = await searchFor(textQuery('carrots', ['carrots']));
		const chicken = await searchFor(textQuery('chicken', ['chicken']));

		expect(titles(carrots)[0]).toBe('Roasted carrots');
		expect(titles(carrots).toSorted()).toEqual([
			'Chicken noodle soup',
			'Roasted carrots',
			'Sunday pot roast',
		]);
		expect(titles(chicken).at(-1)).toBe('Rice bowl');
		expect(chicken).toMatchObject({ total: 4, match: 'exact' });
	});

	it('matches quoted phrases only with their words together', async () => {
		const phrase = await searchFor(textQuery('"pot roast"', ['pot', 'roast']));
		const words = await searchFor(textQuery('pot roast', ['pot', 'roast']));

		expect(titles(phrase)).toEqual(['Sunday pot roast']);
		expect(titles(words).toSorted()).toEqual(['Roasted carrots', 'Sunday pot roast']);
	});

	it('leaves out excluded words', async () => {
		const results = await searchFor(textQuery('soup -chicken', ['soup'], ['chicken']));

		expect(titles(results)).toEqual(['Tomato soup']);
	});

	it('matches either side of or', async () => {
		const results = await searchFor(textQuery('scones or custard', ['scones', 'custard']));

		expect(titles(results).toSorted()).toEqual([
			'Creme caramel',
			'Crème brûlée',
			'Skillet <b>scones</b>',
		]);
	});

	it('ignores accents in both directions and highlights the text as written', async () => {
		const unaccented = await searchFor(textQuery('creme brulee', ['creme', 'brulee']));
		const accented = await searchFor(textQuery('crème', ['crème']));

		expect(titles(unaccented)).toEqual(['Crème brûlée']);
		expect(unaccented.hits[0]?.title).toEqual([
			{ text: 'Crème', highlighted: true },
			{ text: ' ', highlighted: false },
			{ text: 'brûlée', highlighted: true },
		]);
		expect(titles(accented).toSorted()).toEqual(['Creme caramel', 'Crème brûlée']);
	});

	it('browses every recipe when the text is only stop words', async () => {
		const results = await searchFor(textQuery('the', ['the']));

		expect(results).toMatchObject({ total: fixtures.length, match: 'exact' });
		expect(titles(results)[0]).toBe('Creme caramel');
		expect(results.hits[0]?.title).toEqual([{ text: 'Creme caramel', highlighted: false }]);
	});

	it('neither ranks nor highlights words that are only excluded', async () => {
		const results = await searchFor(textQuery('-chicken', [], ['chicken']));

		expect(results.total).toBe(fixtures.length - 4);
		expect(titles(results)[0]).toBe('Creme caramel');
		expect(results.hits.flatMap((hit) => highlighted(hit.title))).toEqual([]);
	});

	it('ranks and highlights the included words when or sits beside an exclusion', async () => {
		const results = await searchFor(textQuery('caramel or -chicken', ['caramel'], ['chicken']));

		expect(titles(results)[0]).toBe('Creme caramel');
		expect(highlighted(results.hits[0]?.title)).toEqual(['caramel']);
	});
});

describe('filters', () => {
	it('keeps the recipes in the chapter', async () => {
		const results = await searchFor(undefined, { chapter: 'desserts' });

		expect(titles(results)).toEqual(['Creme caramel', 'Crème brûlée']);
	});

	it('keeps the recipes for any holiday chosen', async () => {
		const results = await searchFor(undefined, { holidays: ['easter', 'christmas'] });

		expect(titles(results)).toEqual([
			'Creme caramel',
			'Crème brûlée',
			'Skillet <b>scones</b>',
			'Buttermilk biscuits',
			'Sunday pot roast',
		]);
	});

	it('keeps the recipes that suit every diet chosen', async () => {
		const results = await searchFor(undefined, { diets: ['vegetarian', 'gluten-free'] });

		expect(titles(results)).toEqual([
			'Creme caramel',
			'Crème brûlée',
			'Tomato soup',
			'Roasted carrots',
		]);
	});

	it('matches the source, ignoring case', async () => {
		const results = await searchFor(undefined, { source: 'GRANDMA ROSE' });

		expect(titles(results)).toEqual(['Rice bowl', 'Chicken pot pie']);
	});

	it('keeps the recipes the member added', async () => {
		const results = await searchFor(undefined, { contributorId: memberIds.robin });

		expect(titles(results)).toEqual(['Rice bowl', 'Tomato soup', 'Chicken noodle soup']);
	});

	it('keeps recipes whose total time fits, and leaves out those without times', async () => {
		const results = await searchFor(undefined, { maxTotalMinutes: 30 });

		expect(titles(results)).toEqual(['Rice bowl', 'Tomato soup']);
	});

	it('combines filters with the text', async () => {
		const results = await searchFor(textQuery('soup', ['soup']), {
			source: 'grandpa lou',
			maxTotalMinutes: 60,
		});

		expect(titles(results)).toEqual(['Chicken noodle soup']);
	});
});

describe('facets', () => {
	it('counts every chapter, holiday, diet, and total time, even at zero', async () => {
		const results = await searchFor(undefined);

		expect(results.facets.allRecipes).toBe(fixtures.length);
		expect(results.facets.chapters).toEqual({
			'breakfast-brunch': 0,
			'appetizers-beverages': 0,
			'soups-salads': 3,
			'vegetables-sides': 1,
			'main-dishes': 3,
			'breads-rolls': 2,
			desserts: 2,
			'cookies-candy': 0,
			'this-and-that': 0,
		});
		expect(results.facets.holidays).toEqual({
			'new-years-day': 0,
			'st-patricks-day': 0,
			easter: 2,
			'fourth-of-july': 0,
			halloween: 0,
			thanksgiving: 1,
			christmas: 3,
		});
		expect(results.facets.diets).toEqual({
			vegetarian: 6,
			vegan: 1,
			'gluten-free': 6,
			'dairy-free': 5,
		});
		expect(results.facets.totalTimes).toEqual({ 15: 0, 30: 2, 60: 4, 120: 5 });
	});

	it('counts chapters and holidays with every filter but their own, and diets within the results', async () => {
		const results = await searchFor(undefined, {
			chapter: 'desserts',
			holidays: ['christmas'],
			diets: ['vegetarian'],
		});

		expect(titles(results)).toEqual(['Crème brûlée']);
		expect(results.facets.chapters).toEqual({
			...noRecipeSearchFacets.chapters,
			'breads-rolls': 1,
			desserts: 1,
		});
		expect(results.facets.holidays).toEqual({
			...noRecipeSearchFacets.holidays,
			easter: 1,
			christmas: 1,
		});
		expect(results.facets.diets).toEqual({
			vegetarian: 1,
			vegan: 0,
			'gluten-free': 1,
			'dairy-free': 0,
		});
	});

	it('counts All Recipes like the chapters, and each total time with every filter but the time', async () => {
		const results = await searchFor(undefined, { chapter: 'soups-salads', maxTotalMinutes: 30 });

		expect(titles(results)).toEqual(['Tomato soup']);
		expect(results.facets.allRecipes).toBe(2);
		expect(results.facets.chapters).toEqual({
			...noRecipeSearchFacets.chapters,
			'soups-salads': 1,
			'main-dishes': 1,
		});
		expect(results.facets.totalTimes).toEqual({ 15: 0, 30: 1, 60: 2, 120: 2 });
	});

	it('counts sources with every filter but the source', async () => {
		const results = await searchFor(textQuery('chicken', ['chicken']), {
			source: 'Grandpa Lou',
		});

		expect(results.total).toBe(2);
		expect(results.facets.sources).toEqual([
			{ label: 'Grandma Rose', count: 2 },
			{ label: 'Grandpa Lou', count: 2 },
		]);
	});

	it('counts contributors with every filter but the contributor, leaving out members with no recipe the words match', async () => {
		const results = await searchFor(textQuery('soup', ['soup']), {
			contributorId: memberIds.contributor,
		});

		expect(titles(results)).toEqual(['Chicken and rice soup']);
		expect(results.facets.contributors).toEqual([
			{ memberId: memberIds.contributor, displayName: 'Contributor', count: 1 },
			{ memberId: memberIds.robin, displayName: 'Robin', count: 2 },
		]);
	});

	it('orders sources by key and members by name, whatever their counts', async () => {
		const results = await searchFor(undefined, { chapter: 'soups-salads' });

		expect(results.facets.sources).toEqual([
			{ label: 'Aunt June', count: 0 },
			{ label: 'Grandma Rose', count: 0 },
			{ label: 'Grandpa Lou', count: 2 },
		]);
		expect(results.facets.contributors).toEqual([
			{ memberId: memberIds.contributor, displayName: 'Contributor', count: 1 },
			{ memberId: memberIds.robin, displayName: 'Robin', count: 2 },
		]);
	});

	it('lists the chosen member at zero when no result is left', async () => {
		const results = await searchFor(undefined, {
			chapter: 'soups-salads',
			contributorId: memberIds.ada,
		});

		expect(results.total).toBe(0);
		expect(results.facets.contributors).toEqual([
			{ memberId: memberIds.ada, displayName: 'Áda', count: 0 },
			{ memberId: memberIds.contributor, displayName: 'Contributor', count: 1 },
			{ memberId: memberIds.robin, displayName: 'Robin', count: 2 },
		]);
	});

	it('lists no one for a chosen id that names no member', async () => {
		const results = await searchFor(undefined, {
			chapter: 'soups-salads',
			contributorId: unknownMemberId,
		});

		expect(results.total).toBe(0);
		expect(results.facets.contributors.map(({ memberId }) => memberId)).toEqual([
			memberIds.contributor,
			memberIds.robin,
		]);
	});

	it('lists every source and member among the recipes the words match, even at zero', async () => {
		const results = await searchFor(textQuery('soup', ['soup']), { diets: ['vegetarian'] });

		expect(titles(results)).toEqual(['Tomato soup']);
		expect(results.facets.sources).toEqual([{ label: 'Grandpa Lou', count: 0 }]);
		expect(results.facets.contributors).toEqual([
			{ memberId: memberIds.contributor, displayName: 'Contributor', count: 0 },
			{ memberId: memberIds.robin, displayName: 'Robin', count: 1 },
		]);
	});

	it('labels each source with its earliest spelling among the recipes the words match', async () => {
		const everything = await searchFor(undefined, { contributorId: memberIds.robin });
		const rice = await searchFor(textQuery('rice', ['rice']), { contributorId: memberIds.robin });

		expect(everything.facets.sources).toEqual([
			{ label: 'Aunt June', count: 0 },
			{ label: 'Grandma Rose', count: 1 },
			{ label: 'Grandpa Lou', count: 1 },
		]);
		expect(rice.facets.sources).toEqual([
			{ label: 'grandma rose', count: 1 },
			{ label: 'Grandpa Lou', count: 0 },
		]);
	});

	it('counts within close matches too', async () => {
		const results = await searchFor(textQuery('chiken soup', ['chiken', 'soup']));

		expect(results.match).toBe('close');
		expect(results.facets.sources).toEqual([{ label: 'Grandpa Lou', count: 2 }]);
	});

	// Cream matches only Tomato soup exactly, and the desserts' "creme" closely. Each group is chosen
	// in one of the filters, so every count is checked with its own filter left out.
	it.each([
		['no words', undefined],
		['words that match exactly', textQuery('chicken', ['chicken'])],
		['words that match some chapters only closely', textQuery('cream', ['cream'])],
		['words that match only closely', textQuery('chiken soup', ['chiken', 'soup'])],
	])('counts what choosing each option shows, with %s', async (_, text) => {
		const chosenFilters: SearchOptions[] = [
			{ chapter: 'soups-salads', diets: ['gluten-free'] },
			{ holidays: ['christmas'], maxTotalMinutes: 30 },
			{ holidays: ['easter'], maxTotalMinutes: 120 },
			{ source: 'Grandpa Lou', contributorId: memberIds.robin },
		];

		for (const chosen of chosenFilters) {
			const results = await searchFor(text, chosen);
			const options = facetOptions(results.facets, chosen);
			const shown = await Promise.all(
				options.map(async ({ name, applied }) => {
					const { total, match } = await searchFor(text, applied);
					return [name, { total, match }];
				})
			);

			expect(Object.fromEntries(shown), JSON.stringify(chosen)).toEqual(
				Object.fromEntries(
					options.map(({ name, count }) => [name, { total: count, match: results.match }])
				)
			);
		}
	});
});

// The search over the same database, recording each statement it runs.
function loggedSearch(): { search: DrizzleRecipeSearch; statements: string[] } {
	const statements: string[] = [];
	const logger = {
		logQuery: (query: string) => {
			statements.push(query);
		},
	};
	return { search: new DrizzleRecipeSearch(drizzle({ client: db.$client, logger })), statements };
}

// What counting runs once the match is chosen: one aggregate row over the recipes, and the groupings
// by source and by member.
const countStatements = [
	expect.stringMatching(/^select count\(.+ from "recipes"( where .+)?$/),
	expect.stringMatching(
		/^select \(array_agg\(.+ from "recipes" .+ group by "recipes"\."source_key" .+$/
	),
	expect.stringMatching(
		/^select .+ from "users" left join "recipes" .+ group by "users"\."id" .+$/
	),
];

// A recipe's document selected whole, as a page of results selects it, or a highlighted passage.
const recipeDocumentOrHeadline = /"content",|ts_headline/;

describe('counts', () => {
	it('give the total and facets search gives, without words and with exact and close matches', async () => {
		const chosenFilters: [RecipeTextQuery | undefined, SearchOptions][] = [
			[undefined, { chapter: 'desserts' }],
			[textQuery('chicken', ['chicken']), { source: 'Grandpa Lou', maxTotalMinutes: 60 }],
			[
				textQuery('chiken soup', ['chiken', 'soup']),
				{ diets: ['dairy-free'], contributorId: memberIds.ada },
			],
		];

		for (const [text, chosen] of chosenFilters) {
			const { total, facets } = await searchFor(text, chosen);

			expect(await search.count({ text, holidays: [], diets: [], ...chosen })).toEqual({
				total,
				facets,
			});
		}
	});

	it('run the aggregate row and the two groupings alone, selecting no recipe and no headline', async () => {
		const { search: logged, statements } = loggedSearch();

		await logged.count({ chapter: 'desserts', holidays: [], diets: [] });

		expect(statements).toHaveLength(countStatements.length);
		expect(statements).toEqual(expect.arrayContaining(countStatements));
		for (const statement of statements) {
			expect(statement).not.toMatch(recipeDocumentOrHeadline);
		}
	});

	it('choose the match from the words first, as search does', async () => {
		const { search: logged, statements } = loggedSearch();

		await logged.count({ text: textQuery('chiken', ['chiken']), holidays: [], diets: [] });

		expect(statements[0]).toMatch(/^select not exists \(.+\) and exists \(.+\) as close$/);
		expect(statements.slice(1)).toHaveLength(countStatements.length);
		expect(statements.slice(1)).toEqual(expect.arrayContaining(countStatements));
	});
});

describe('close matches', () => {
	it.each([
		['chiken soup', ['chiken', 'soup'], ['Chicken and rice soup', 'Chicken noodle soup']],
		['biscut', ['biscut'], ['Buttermilk biscuits']],
		['pot rost', ['pot', 'rost'], ['Sunday pot roast']],
	])('finds %j by similarity when nothing matches exactly', async (text, words, expected) => {
		const results = await searchFor(textQuery(text, words));

		expect(results).toMatchObject({ match: 'close', total: expected.length });
		expect(titles(results).toSorted()).toEqual(expected);
	});

	it('leaves out excluded words', async () => {
		const results = await searchFor(
			textQuery('chiken soup -noodle', ['chiken', 'soup'], ['noodle'])
		);

		expect(results.match).toBe('close');
		expect(titles(results)).toEqual(['Chicken and rice soup']);
	});

	it('keeps to exact matches when the words have some, even where the filters leave none', async () => {
		const results = await searchFor(textQuery('cream', ['cream']), { chapter: 'desserts' });

		expect(results).toMatchObject({ hits: [], total: 0, match: 'exact' });
		expect(results.facets.chapters).toEqual({
			...noRecipeSearchFacets.chapters,
			'soups-salads': 1,
		});
	});

	it('keeps to close matches where the filters leave none, and counts them', async () => {
		const results = await searchFor(textQuery('chiken soup', ['chiken', 'soup']), {
			chapter: 'desserts',
		});

		expect(results).toMatchObject({ hits: [], total: 0, match: 'close' });
		expect(results.facets.chapters).toEqual({
			...noRecipeSearchFacets.chapters,
			'soups-salads': 2,
		});
	});

	it('returns the empty exact result when nothing is close either', async () => {
		const results = await searchFor(textQuery('xylophone', ['xylophone']));

		expect(results).toMatchObject({ hits: [], total: 0, match: 'exact' });
	});

	it('shows plain titles and descriptions', async () => {
		const results = await searchFor(textQuery('biscut', ['biscut']));

		expect(results.hits[0]).toMatchObject({
			title: [{ text: 'Buttermilk biscuits', highlighted: false }],
			snippet: [
				{ text: 'Tall and flaky, from cold butter and a gentle hand.', highlighted: false },
			],
		});
	});
});

describe('snippets', () => {
	it('come from the description first', async () => {
		const results = await searchFor(textQuery('custard', ['custard']));
		const brulee = results.hits.find((hit) => hit.recipe.title === 'Crème brûlée');

		expect(brulee?.snippet).toEqual([
			{ text: 'A ', highlighted: false },
			{ text: 'custard', highlighted: true },
			{ text: ' under a crackly sugar top', highlighted: false },
		]);
	});

	it('show ingredient lines as written, marking where a fragment drops a leading amount', async () => {
		const results = await searchFor(textQuery('scallions', ['scallions']));

		expect(highlighted(results.hits[0]?.snippet)).toEqual(['scallions']);
		expect(joined(results.hits[0]?.snippet)).toBe(
			'… cups cooked rice · 2 scallions, thinly sliced'
		);
	});

	it('come from the notes before the steps', async () => {
		const results = await searchFor(textQuery('juice glass', ['juice', 'glass']));

		expect(joined(results.hits[0]?.snippet)).toBe('Cut them with a juice glass and never twist it');
	});

	it('come from the steps last, with ellipses where the text is cut', async () => {
		const results = await searchFor(textQuery('fork', ['fork']));
		const snippet = results.hits[0]?.snippet ?? [];

		expect(highlighted(snippet)).toEqual(['fork']);
		expect(snippet[0]?.text.startsWith('… ')).toBe(true);
		expect(snippet.at(-1)?.text.endsWith(' …')).toBe(true);
	});

	it('show the description when only the title or source matched', async () => {
		const title = await searchFor(textQuery('brulee', ['brulee']));
		const source = await searchFor(textQuery('june', ['june']));

		expect(title.hits[0]?.snippet).toEqual([
			{ text: 'A custard under a crackly sugar top.', highlighted: false },
		]);
		expect(source.hits[0]?.snippet).toEqual([
			{ text: 'A slow braise for a cold weekend.', highlighted: false },
		]);
	});

	it('are left out when only the title matched and there is no description', async () => {
		const results = await searchFor(textQuery('pie', ['pie']));

		expect(titles(results)).toEqual(['Chicken pot pie']);
		expect(results.hits[0]?.snippet).toBeUndefined();
	});

	it('keep tag-like recipe text as text', async () => {
		const results = await searchFor(textQuery('scones', ['scones']));
		const hit = results.hits[0];

		expect(joined(hit?.title)).toBe('Skillet <b>scones</b>');
		expect(highlighted(hit?.title)).toEqual(['scones']);
		expect(highlighted(hit?.snippet)).toEqual(['scones']);
	});
});

describe('paging and sorting', () => {
	it('returns no hits but the full total past the end', async () => {
		const results = await searchFor(textQuery('soup', ['soup']), { offset: 24 });

		expect(results).toMatchObject({ hits: [], total: 3 });
	});

	it('pages through relevance in rank order', async () => {
		const all = await searchFor(textQuery('chicken', ['chicken']));
		const pages = [
			await searchFor(textQuery('chicken', ['chicken']), { limit: 3 }),
			await searchFor(textQuery('chicken', ['chicken']), { limit: 3, offset: 3 }),
		];

		expect(pages.flatMap(titles)).toEqual(titles(all));
	});

	it('sorts by newest and by title, ignoring accents', async () => {
		const newest = await searchFor(textQuery('custard or scones', ['custard', 'scones']), {
			sort: 'newest',
		});
		const title = await searchFor(undefined, { sort: 'title', limit: 5 });

		expect(titles(newest)).toEqual(['Creme caramel', 'Crème brûlée', 'Skillet <b>scones</b>']);
		expect(titles(title)).toEqual([
			'Buttermilk biscuits',
			'Chicken and rice soup',
			'Chicken noodle soup',
			'Chicken pot pie',
			'Crème brûlée',
		]);
	});

	it('lists the newest first by relevance without text', async () => {
		const results = await searchFor(undefined, { limit: 3 });

		expect(titles(results)).toEqual(['Creme caramel', 'Crème brûlée', 'Skillet <b>scones</b>']);
	});
});
