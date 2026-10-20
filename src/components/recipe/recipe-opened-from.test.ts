import { describe, expect, it } from 'vitest';
import {
	openerEntryIndex,
	readRecipeOpenedFrom,
	recipeOpenedFrom,
	recipeOpenedFromKey,
	recipeOpenedFromValue,
} from '@/components/recipe/recipe-opened-from';

const origin = 'https://barbtable.com';

// The value a list keeps for the recipe, as it records one.
function kept(url: string, backLabel = 'Back to Favorites'): string {
	return recipeOpenedFromValue({ url, backLabel });
}

describe('readRecipeOpenedFrom', () => {
	it('reads each list a recipe can be opened from, its page whole, with the label it recorded', () => {
		const lists = [
			[`${origin}/?page=2&sort=title`, 'Back to recipes', '/'],
			[
				`${origin}/search?q=chicken&chapter=main-dishes&sort=newest&page=2`,
				'Back to search results',
				'/search',
			],
			[`${origin}/favorites?page=2`, 'Back to Favorites', '/favorites'],
		] as const;

		for (const [url, backLabel, listPathname] of lists) {
			expect(readRecipeOpenedFrom(kept(url, backLabel))).toEqual({ url, backLabel, listPathname });
		}
	});

	it('reads none for a page that is not a list, even when a recipe was opened from it', () => {
		for (const url of [
			`${origin}/design`,
			`${origin}/favorites-old`,
			`${origin}/recipes/lemon-bars`,
			'favorites',
		]) {
			expect(readRecipeOpenedFrom(kept(url))).toBeUndefined();
		}
	});

	it('reads none where nothing is kept, or what is kept is no record', () => {
		expect(readRecipeOpenedFrom(undefined)).toBeUndefined();
		// The bare URL an earlier version kept, in a tab open since.
		expect(readRecipeOpenedFrom(`${origin}/favorites?page=2`)).toBeUndefined();
		expect(readRecipeOpenedFrom(JSON.stringify({ url: `${origin}/favorites` }))).toBeUndefined();
		expect(readRecipeOpenedFrom(kept(`${origin}/favorites`, ''))).toBeUndefined();
	});
});

describe('recipeOpenedFrom', () => {
	it('names the list the recipe was reached from, as it recorded it', () => {
		const url = `${origin}/search?q=chicken&chapter=main-dishes&sort=newest&page=2`;

		expect(recipeOpenedFrom(kept(url, 'Back to search results'), url)).toEqual({
			url,
			backLabel: 'Back to search results',
			listPathname: '/search',
		});
	});

	it('names no list when the recipe was reached from another entry than the one recorded', () => {
		const recorded = kept(`${origin}/favorites?page=2`);

		// Saved from the edit page, which then leads to the recipe.
		expect(recipeOpenedFrom(recorded, `${origin}/recipes/sunday-pot-roast/edit`)).toBeUndefined();
		// The list's other page, which going back would not return to.
		expect(recipeOpenedFrom(recorded, `${origin}/favorites`)).toBeUndefined();
		expect(
			recipeOpenedFrom(
				kept(`${origin}/search?q=chicken&chapter=main-dishes`, 'Back to search results'),
				`${origin}/search?q=chicken&chapter=main-dishes&diet=vegetarian`
			)
		).toBeUndefined();
	});

	it('names no list for a recipe opened in a new tab, from a shared link, or without a record', () => {
		// A new tab has no entry before the recipe, even with this tab's record copied into it.
		expect(recipeOpenedFrom(kept(`${origin}/favorites`), undefined)).toBeUndefined();
		// An entry whose URL the browser withholds.
		expect(recipeOpenedFrom(kept(`${origin}/favorites`), null)).toBeUndefined();
		expect(recipeOpenedFrom(undefined, `${origin}/favorites`)).toBeUndefined();
	});

	it('names no list for a page that is not one, even when the recipe was reached from it', () => {
		const url = `${origin}/design`;

		expect(recipeOpenedFrom(kept(url), url)).toBeUndefined();
	});
});

describe('openerEntryIndex', () => {
	const recipe = '/recipes/lemon-bars';

	it('finds the entry before the recipe', () => {
		expect(
			openerEntryIndex(
				[`${origin}/`, `${origin}/favorites?page=2`, `${origin}${recipe}`],
				2,
				recipe
			)
		).toBe(1);
	});

	it('finds the current entry while the recipe renders before its own entry is pushed', () => {
		expect(openerEntryIndex([`${origin}/`, `${origin}/favorites?page=2`], 1, recipe)).toBe(1);
	});

	it('looks past the entries a jump within the recipe adds', () => {
		expect(
			openerEntryIndex(
				[
					`${origin}/search?q=lemon`,
					`${origin}${recipe}`,
					`${origin}${recipe}#lemon-bars-original`,
				],
				2,
				recipe
			)
		).toBe(0);
	});

	it('finds none for a recipe that is the first entry, as in a new tab', () => {
		expect(openerEntryIndex([`${origin}${recipe}`], 0, recipe)).toBeUndefined();
	});
});

describe('recipeOpenedFromKey', () => {
	it('keeps a record for each recipe, by its page', () => {
		expect(recipeOpenedFromKey('/recipes/lemon-bars')).toBe('opened-from:/recipes/lemon-bars');
	});
});
