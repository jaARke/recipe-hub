import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NewMember } from '@/application/ports/member-repository';
import type { RecipeSearchQuery, RecipeSearchResults } from '@/application/ports/recipe-search';
import { parseRecipeTextQuery } from '@/application/search/recipe-text-query';
import type { MemberId } from '@/domain/member/member';
import { recipeContentSchema } from '@/domain/recipe/recipe';
import { sampleRecipeContents } from '@/domain/recipe/samples/sample-recipes';
import { slugify } from '@/domain/recipe/slug';
import { DrizzleMemberRepository } from '@/infrastructure/db/drizzle-member-repository';
import { DrizzleRecipeRepository } from '@/infrastructure/db/drizzle-recipe-repository';
import { DrizzleRecipeSearch } from '@/infrastructure/db/drizzle-recipe-search';
import { createTestDatabase, type TestDatabase } from '@/infrastructure/db/testing/test-database';

// Expected results over every sample recipe, as the seeded previews hold them.

const contributor: NewMember = {
	email: 'contributor@example.com',
	displayName: 'Contributor',
	role: 'member',
};

const chickenRecipes = [
	'Chicken and dumplings',
	'Lemon garlic roast chicken with potatoes',
	'Weeknight chicken soup',
	'Yellow chicken curry with rice',
];
const biscuitRecipes = [
	'Buttermilk biscuits',
	'Peach cobbler with biscuit topping',
	'Sausage gravy over biscuits',
];
const tomatoRecipes = [
	'Black bean chili',
	'Chickpea and tomato stew',
	'Garden tomato salad',
	'Minestrone',
	'Sunday pot roast',
	'Tomato basil bruschetta',
	'Tomato basil soup',
	'Tomato tart with crème fraîche and basil',
];
const tanteHeleneRecipes = [
	'Crème brûlée',
	'Tomato tart with crème fraîche and basil',
	'Éclairs with chocolate glaze',
];

// The search shares one database, since none of the tests writes.
let db: TestDatabase;
let search: DrizzleRecipeSearch;
let contributorId: MemberId;

beforeAll(async () => {
	db = await createTestDatabase();
	search = new DrizzleRecipeSearch(db);
	const repository = new DrizzleRecipeRepository(db);
	contributorId = (await new DrizzleMemberRepository(db).create(contributor)).id;
	for (const input of sampleRecipeContents) {
		const content = recipeContentSchema.parse(input);
		await repository.create({
			content,
			provenance: { entryMode: 'manual' },
			contributorId,
			slugBase: slugify(content.title),
		});
	}
});

afterAll(async () => {
	await db.$client.close();
});

function searchFor(
	text: string | undefined,
	options: Partial<Omit<RecipeSearchQuery, 'text'>> = {}
): Promise<RecipeSearchResults> {
	return search.search({
		text: text === undefined ? undefined : parseRecipeTextQuery(text),
		tags: [],
		sort: 'relevance',
		limit: sampleRecipeContents.length,
		offset: 0,
		...options,
	});
}

function titles(results: RecipeSearchResults): string[] {
	return results.hits.map((hit) => hit.recipe.title);
}

function sorted(list: string[]): string[] {
	return list.toSorted();
}

describe('misspellings', () => {
	it.each([
		['chiken', chickenRecipes],
		['biscut', biscuitRecipes],
		['molases', ['Molasses spice cookies']],
		['pot rost', ['Sunday pot roast']],
		['jalapeno corn bread', ['Jalapeño cornbread']],
	])('find %j by similarity', async (text, expected) => {
		const results = await searchFor(text);

		expect(results.match).toBe('close');
		expect(sorted(titles(results))).toEqual(sorted(expected));
	});

	it.each([
		['chiken soup', 'Weeknight chicken soup'],
		['chicken soop', 'Weeknight chicken soup'],
		['molases cookies', 'Molasses spice cookies'],
	])('find the recipe %j means first', async (text, expected) => {
		const results = await searchFor(text);

		expect(results.match).toBe('close');
		expect(titles(results)[0]).toBe(expected);
	});

	it('match exactly when stemming already absorbs the slip', async () => {
		const tomatoe = await searchFor('tomatoe');
		const brule = await searchFor('brule');

		expect(tomatoe.match).toBe('exact');
		expect(sorted(titles(tomatoe))).toEqual(sorted(tomatoRecipes));
		expect(brule.match).toBe('exact');
		expect(titles(brule)).toEqual(['Crème brûlée']);
	});

	it.each(['beef tacos', 'pizza', 'xyzzy', 'sushi'])(
		'leave %j with nothing close',
		async (text) => {
			const results = await searchFor(text);

			expect(results).toMatchObject({ hits: [], total: 0, match: 'exact' });
		}
	);

	it('offer only a clearly close recipe for a dish the corpus lacks', async () => {
		const results = await searchFor('lamb stew');

		expect(results.match).toBe('close');
		expect(titles(results)).toEqual(['Chickpea and tomato stew']);
	});
});

describe('text', () => {
	it('requires every ingredient in a combination', async () => {
		const results = await searchFor('tomato basil');

		expect(sorted(titles(results))).toEqual([
			'Garden tomato salad',
			'Tomato basil bruschetta',
			'Tomato basil soup',
			'Tomato tart with crème fraîche and basil',
		]);
	});

	// Each chapter's words find every recipe in it, so the salad and the bars are found too.
	it('leaves out excluded words', async () => {
		const soups = await searchFor('soup -chicken');
		const cookies = await searchFor('cookies -molasses');

		expect(sorted(titles(soups))).toEqual([
			'Garden tomato salad',
			'Minestrone',
			'Roasted carrot ginger soup',
			'Split pea soup',
			'Tomato basil soup',
		]);
		expect(sorted(titles(cookies))).toEqual([
			'Chocolate chip cookies with brown butter',
			'Lemon bars',
			'Oatmeal raisin cookies',
		]);
	});

	it('matches a quoted phrase', async () => {
		const results = await searchFor('"pot roast"');

		expect(titles(results)).toEqual(['Sunday pot roast']);
	});

	it('matches either side of or', async () => {
		const results = await searchFor('cornbread or biscuits');

		expect(sorted(titles(results))).toEqual(sorted([...biscuitRecipes, 'Jalapeño cornbread']));
	});

	it('reaches whole words from a partial one, closest first', async () => {
		const results = await searchFor('chick');

		expect(results.match).toBe('close');
		expect(sorted(titles(results).slice(0, 5))).toEqual(
			sorted([...chickenRecipes, 'Chickpea and tomato stew'])
		);
	});

	it.each([
		['creme brulee', ['Crème brûlée']],
		['crème brûlée', ['Crème brûlée']],
		['jalapeno', ['Jalapeño cornbread']],
		['jalapeño', ['Jalapeño cornbread']],
		['helene', tanteHeleneRecipes],
		['hélène', tanteHeleneRecipes],
	])('ignores accents for %j', async (text, expected) => {
		const results = await searchFor(text);

		expect(results.match).toBe('exact');
		expect(sorted(titles(results))).toEqual(sorted(expected));
	});
});

describe('filters', () => {
	it('match a source', async () => {
		const results = await searchFor(undefined, { source: 'Aunt June' });

		expect(sorted(titles(results))).toEqual([
			'Buttermilk biscuits',
			'Lemon garlic roast chicken with potatoes',
			'Peach cobbler with biscuit topping',
			'Sausage gravy over biscuits',
		]);
	});

	it('require every tag', async () => {
		const soups = await searchFor(undefined, { tags: ['Soup', 'Vegetarian'] });
		const desserts = await searchFor(undefined, { tags: ['baking', 'dessert'] });

		expect(sorted(titles(soups))).toEqual([
			'Minestrone',
			'Roasted carrot ginger soup',
			'Tomato basil soup',
		]);
		expect(sorted(titles(desserts))).toEqual([
			'Chocolate chip cookies with brown butter',
			'Lemon bars',
			'Oatmeal raisin cookies',
			'Peach cobbler with biscuit topping',
			'Éclairs with chocolate glaze',
		]);
	});

	it('keep recipes within each total time, never those without times', async () => {
		const quarterHour = await searchFor(undefined, { maxTotalMinutes: 15 });
		const halfHour = await searchFor(undefined, { maxTotalMinutes: 30 });
		const hour = await searchFor(undefined, { maxTotalMinutes: 60 });
		const twoHours = await searchFor(undefined, { maxTotalMinutes: 120 });
		const all = await searchFor(undefined);

		expect(sorted(titles(quarterHour))).toEqual(['Garden tomato salad', 'Tomato basil bruschetta']);
		expect(sorted(titles(halfHour))).toEqual([
			'Chickpea and tomato stew',
			'Garden tomato salad',
			'Oatmeal raisin cookies',
			'Sausage gravy over biscuits',
			'Tomato basil bruschetta',
		]);
		expect(hour.total).toBe(17);
		expect(sorted(titles(all).filter((title) => !titles(twoHours).includes(title)))).toEqual([
			'Apple cabbage slaw',
			'Crème brûlée',
			'Lemon icebox pie with a graham cracker crust',
			'Overnight cinnamon rolls',
			'Quick pickled red onions',
			'Sunday pot roast',
		]);
	});
});

describe('facets', () => {
	it('count the tags, sources, and contributors of a typical search', async () => {
		const results = await searchFor('tomato');

		expect(results.total).toBe(tomatoRecipes.length);
		expect(results.facets).toEqual({
			tags: [
				{ label: 'Vegetarian', count: 7 },
				{ label: 'Make ahead', count: 3 },
				{ label: 'Summer', count: 3 },
				{ label: 'Dinner', count: 2 },
				{ label: 'Soup', count: 2 },
				{ label: 'Appetizer', count: 1 },
				{ label: 'Français', count: 1 },
				{ label: 'Main', count: 1 },
				{ label: 'Salad', count: 1 },
				{ label: 'Slow cooked', count: 1 },
				{ label: 'Weeknight', count: 1 },
			],
			sources: [
				{ label: 'Riverbend Community Cookbook', count: 2 },
				{ label: 'Cousin Maya', count: 1 },
				{ label: 'Grandpa Lou', count: 1 },
				{ label: 'Tante Hélène', count: 1 },
				{ label: 'Uncle Ray', count: 1 },
			],
			contributors: [
				{ memberId: contributorId, displayName: 'Contributor', count: tomatoRecipes.length },
			],
		});
	});
});

describe('sorting', () => {
	it('lists A to Z with accented titles among their letters', async () => {
		const results = await searchFor(undefined, { sort: 'title' });

		expect(titles(results)).toEqual([
			'Apple cabbage slaw',
			'Black bean chili',
			'Buttermilk biscuits',
			'Chicken and dumplings',
			'Chickpea and tomato stew',
			'Chocolate chip cookies with brown butter',
			'Crème brûlée',
			'Éclairs with chocolate glaze',
			'Garden tomato salad',
			'Jalapeño cornbread',
			'Lemon bars',
			'Lemon garlic roast chicken with potatoes',
			'Lemon icebox pie with a graham cracker crust',
			'Minestrone',
			'Molasses spice cookies',
			'Oatmeal raisin cookies',
			'Overnight cinnamon rolls',
			'Peach cobbler with biscuit topping',
			'Quick pickled red onions',
			'Roasted carrot ginger soup',
			'Sausage gravy over biscuits',
			'Split pea soup',
			'Sunday pot roast',
			'Tomato basil bruschetta',
			'Tomato basil soup',
			'Tomato tart with crème fraîche and basil',
			'Vanilla rice pudding',
			'Weeknight chicken soup',
			'Yellow chicken curry with rice',
			'Zucchini bread',
		]);
	});
});
