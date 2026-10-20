import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NewMember } from '@/application/ports/member-repository';
import type {
	HighlightedText,
	RecipeSearchQuery,
	RecipeSearchResults,
	RecipeTextQuery,
} from '@/application/ports/recipe-search';
import { memberIdSchema, type MemberId } from '@/domain/member/member';
import type { RecipeTimes } from '@/domain/recipe/duration';
import type { IngredientLine } from '@/domain/recipe/ingredient';
import { recipeContentSchema, type RecipeContentInput } from '@/domain/recipe/recipe';
import { slugify } from '@/domain/recipe/slug';
import { DrizzleMemberRepository } from '@/infrastructure/db/drizzle-member-repository';
import { DrizzleRecipeRepository } from '@/infrastructure/db/drizzle-recipe-repository';
import { DrizzleRecipeSearch } from '@/infrastructure/db/drizzle-recipe-search';
import { recipes } from '@/infrastructure/db/schema';
import { createTestDatabase, type TestDatabase } from '@/infrastructure/db/testing/test-database';

// Robin joins first, so on a tie in the contributor facet only the name puts Robin second. Ada
// adds no recipes.
const members = {
	robin: { email: 'robin@example.com', displayName: 'Robin', role: 'member' },
	contributor: { email: 'contributor@example.com', displayName: 'Contributor', role: 'member' },
	ada: { email: 'ada@example.com', displayName: 'Ada', role: 'member' },
} satisfies Record<string, NewMember>;
type MemberName = keyof typeof members;

const unknownMemberId = memberIdSchema.parse('0199c7a4-2c3e-7b1a-9f00-2a7c1e4b5d6e');
const dayInMilliseconds = 24 * 60 * 60 * 1000;

type Fixture = {
	title: string;
	daysAgo: number;
	// The contributor unless given.
	addedBy?: MemberName;
	description?: string;
	notes?: string;
	source?: string;
	lines?: Pick<IngredientLine, 'text' | 'item'>[];
	steps?: string[];
	tags?: string[];
	times?: RecipeTimes;
};

// Listed oldest first. Recipes whose text matters to a test spell it out; the rest stay terse.
const fixtures: Fixture[] = [
	{
		title: 'Chicken pot pie',
		daysAgo: 400,
		source: 'Grandma Rose',
		lines: [
			{ text: '1 pound chicken thighs', item: 'chicken thighs' },
			{ text: '1 cup frozen peas', item: 'frozen peas' },
		],
		tags: ['Main', 'Make ahead'],
		times: { totalMinutes: 90 },
	},
	{
		title: 'Sunday pot roast',
		daysAgo: 100,
		description: 'A slow braise for a cold weekend.',
		source: 'Aunt June',
		lines: [
			{ text: '3 pounds chuck roast', item: 'chuck roast' },
			{ text: '4 carrots, cut in chunks', item: 'carrots' },
		],
		tags: ['Main', 'Slow cooked'],
		times: { prepMinutes: 20, cookMinutes: 240 },
	},
	{
		title: 'Roasted carrots',
		daysAgo: 90,
		lines: [{ text: '1 pound carrots', item: 'carrots' }],
		steps: ['Warm the pot, then roast the carrots until browned.'],
		tags: ['Side'],
	},
	{
		title: 'Chicken noodle soup',
		daysAgo: 60,
		addedBy: 'robin',
		source: 'Grandpa Lou',
		lines: [
			{ text: '2 cups chicken, shredded', item: 'chicken' },
			{ text: '4 ounces egg noodles', item: 'egg noodles' },
			{ text: '2 carrots, sliced', item: 'carrots' },
		],
		tags: ['Soup'],
		times: { prepMinutes: 15, cookMinutes: 35 },
	},
	{
		title: 'Chicken and rice soup',
		daysAgo: 50,
		source: 'Grandpa Lou',
		lines: [
			{ text: '2 cups chicken, shredded', item: 'chicken' },
			{ text: '1 cup rice', item: 'rice' },
		],
		tags: ['soup'],
	},
	{
		title: 'Tomato soup',
		daysAgo: 40,
		addedBy: 'robin',
		description: 'Bright and quick, with a swirl of cream.',
		lines: [
			{ text: '2 cans whole tomatoes', item: 'whole tomatoes' },
			{ text: '½ cup heavy cream', item: 'heavy cream' },
		],
		tags: ['Soup', 'Vegetarian'],
		times: { totalMinutes: 30 },
	},
	{
		title: 'Buttermilk biscuits',
		daysAgo: 30,
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
		tags: ['Baking', 'Breakfast'],
		times: { prepMinutes: 15, cookMinutes: 18, totalMinutes: 35 },
	},
	{
		title: 'Rice bowl',
		daysAgo: 20,
		addedBy: 'robin',
		description: 'A weeknight bowl built on leftovers.',
		source: 'grandma rose',
		lines: [
			{ text: '2 cups cooked rice', item: 'cooked rice' },
			{ text: '2 scallions, thinly sliced', item: 'scallions' },
		],
		steps: ['Warm the rice.', 'Add the chicken and toss with the scallions.'],
		tags: ['Weeknight'],
		times: { prepMinutes: 10, cookMinutes: 15 },
	},
	{
		title: 'Skillet <b>scones</b>',
		daysAgo: 10,
		description: 'Bake the <i>scones</i> in a hot skillet.',
		tags: ['Baking'],
	},
	{
		title: 'Crème brûlée',
		daysAgo: 3,
		description: 'A custard under a crackly sugar top.',
		tags: ['Dessert'],
		times: { totalMinutes: 300 },
	},
	{
		title: 'Creme caramel',
		daysAgo: 2,
		description: 'A custard that turns out of its dish.',
		tags: ['dessert', 'Sweet, salty'],
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
		chapter: 'this-and-that',
		holidays: [],
		diets: [],
		tags: fixture.tags ?? [],
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

function searchFor(
	text: RecipeTextQuery | undefined,
	options: Partial<Omit<RecipeSearchQuery, 'text'>> = {}
): Promise<RecipeSearchResults> {
	return search.search({ text, tags: [], sort: 'relevance', limit: 24, offset: 0, ...options });
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
	it('requires every tag, ignoring case', async () => {
		const results = await searchFor(undefined, { tags: ['soup', 'VEGETARIAN'] });
		const withComma = await searchFor(undefined, { tags: ['sweet, SALTY'] });

		expect(titles(results)).toEqual(['Tomato soup']);
		expect(titles(withComma)).toEqual(['Creme caramel']);
	});

	it('matches the source, ignoring case', async () => {
		const results = await searchFor(undefined, { source: 'GRANDMA ROSE' });

		expect(titles(results)).toEqual(['Rice bowl', 'Chicken pot pie']);
	});

	it('keeps the recipes the member added', async () => {
		const results = await searchFor(undefined, { contributorId: memberIds.robin });

		expect(titles(results)).toEqual(['Rice bowl', 'Tomato soup', 'Chicken noodle soup']);
		expect(results.facets.sources).toEqual([
			{ label: 'grandma rose', count: 1 },
			{ label: 'Grandpa Lou', count: 1 },
		]);
	});

	it('keeps recipes whose total time fits, and leaves out those without times', async () => {
		const results = await searchFor(undefined, { maxTotalMinutes: 35 });

		expect(titles(results)).toEqual(['Rice bowl', 'Buttermilk biscuits', 'Tomato soup']);
	});

	it('keeps recipes added within the window', async () => {
		const week = await searchFor(undefined, { addedWithin: 'week' });
		const month = await searchFor(undefined, { addedWithin: 'month' });
		const year = await searchFor(undefined, { addedWithin: 'year' });

		expect(titles(week)).toEqual(['Creme caramel', 'Crème brûlée']);
		expect(titles(month)).toEqual([
			'Creme caramel',
			'Crème brûlée',
			'Skillet <b>scones</b>',
			'Rice bowl',
		]);
		expect(year.total).toBe(fixtures.length - 1);
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
	it('counts tags within the results, labeled by the earliest spelling', async () => {
		const results = await searchFor(undefined);

		expect(results.facets.tags).toEqual([
			{ label: 'Soup', count: 3 },
			{ label: 'Baking', count: 2 },
			{ label: 'Dessert', count: 2 },
			{ label: 'Main', count: 2 },
			{ label: 'Breakfast', count: 1 },
			{ label: 'Make ahead', count: 1 },
			{ label: 'Side', count: 1 },
			{ label: 'Slow cooked', count: 1 },
			{ label: 'Sweet, salty', count: 1 },
			{ label: 'Vegetarian', count: 1 },
			{ label: 'Weeknight', count: 1 },
		]);
	});

	it('counts sources with every filter but the source', async () => {
		const results = await searchFor(textQuery('chicken', ['chicken']), {
			source: 'Grandpa Lou',
		});

		expect(results.total).toBe(2);
		expect(results.facets.tags).toEqual([{ label: 'Soup', count: 2 }]);
		expect(results.facets.sources).toEqual([
			{ label: 'Grandma Rose', count: 2 },
			{ label: 'Grandpa Lou', count: 2 },
		]);
	});

	it('counts contributors with every filter but the contributor, leaving out members with none', async () => {
		const results = await searchFor(textQuery('soup', ['soup']), {
			contributorId: memberIds.contributor,
		});

		expect(titles(results)).toEqual(['Chicken and rice soup']);
		expect(results.facets.contributors).toEqual([
			{ memberId: memberIds.robin, displayName: 'Robin', count: 2 },
			{ memberId: memberIds.contributor, displayName: 'Contributor', count: 1 },
		]);
	});

	it('orders contributors with the same count by name', async () => {
		const results = await searchFor(textQuery('chicken', ['chicken']));

		expect(results.facets.contributors).toEqual([
			{ memberId: memberIds.contributor, displayName: 'Contributor', count: 2 },
			{ memberId: memberIds.robin, displayName: 'Robin', count: 2 },
		]);
	});

	it('lists the chosen member at zero when no result is left', async () => {
		const results = await searchFor(undefined, { tags: ['Soup'], contributorId: memberIds.ada });

		expect(results.total).toBe(0);
		expect(results.facets.contributors).toEqual([
			{ memberId: memberIds.robin, displayName: 'Robin', count: 2 },
			{ memberId: memberIds.contributor, displayName: 'Contributor', count: 1 },
			{ memberId: memberIds.ada, displayName: 'Ada', count: 0 },
		]);
	});

	it('lists no one for a chosen id that names no member', async () => {
		const results = await searchFor(undefined, { tags: ['Soup'], contributorId: unknownMemberId });

		expect(results.total).toBe(0);
		expect(results.facets.contributors.map(({ memberId }) => memberId)).toEqual([
			memberIds.robin,
			memberIds.contributor,
		]);
	});

	it('counts within close matches too', async () => {
		const results = await searchFor(textQuery('chiken soup', ['chiken', 'soup']));

		expect(results.match).toBe('close');
		expect(results.facets.sources).toEqual([{ label: 'Grandpa Lou', count: 2 }]);
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
