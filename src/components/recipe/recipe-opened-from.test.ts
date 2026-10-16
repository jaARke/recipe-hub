import { describe, expect, it } from 'vitest';
import {
	openerEntryIndex,
	recipeListOf,
	recipeOpenedFromKey,
	recipeOpenedFromUrl,
} from '@/components/recipe/recipe-opened-from';

const origin = 'https://barbtable.com';

describe('recipeOpenedFromUrl', () => {
	it('names each list a recipe can be opened from by its page, query included', () => {
		const lists = [
			[`${origin}/?page=2&sort=title`, 'Back to recipes'],
			[`${origin}/search?q=chicken&tags=dinner&sort=newest&page=2`, 'Back to search results'],
			[`${origin}/favorites?page=2`, 'Back to Favorites'],
		] as const;

		for (const [url, backLabel] of lists) {
			expect(recipeOpenedFromUrl(url, url)).toBe(url);
			expect(recipeListOf(url)?.backLabel).toBe(backLabel);
		}
	});

	it('names no list when the recipe was reached from another entry than the one recorded', () => {
		const recorded = `${origin}/favorites?page=2`;

		// Saved from the edit page, which then leads to the recipe.
		expect(
			recipeOpenedFromUrl(recorded, `${origin}/recipes/sunday-pot-roast/edit`)
		).toBeUndefined();
		// The list's other page, which going back would not return to.
		expect(recipeOpenedFromUrl(recorded, `${origin}/favorites`)).toBeUndefined();
		expect(
			recipeOpenedFromUrl(
				`${origin}/search?q=chicken&tags=dinner`,
				`${origin}/search?q=chicken&tags=dinner&tags=quick`
			)
		).toBeUndefined();
	});

	it('names no list for a recipe opened in a new tab, from a shared link, or without a record', () => {
		// A new tab has no entry before the recipe, even with this tab's record copied into it.
		expect(recipeOpenedFromUrl(`${origin}/favorites`, undefined)).toBeUndefined();
		// An entry whose URL the browser withholds.
		expect(recipeOpenedFromUrl(`${origin}/favorites`, null)).toBeUndefined();
		expect(recipeOpenedFromUrl(undefined, `${origin}/favorites`)).toBeUndefined();
	});

	it('names no list for a page that is not one, even when the recipe was opened from it', () => {
		for (const url of [
			`${origin}/design`,
			`${origin}/favorites-old`,
			`${origin}/recipes/lemon-bars`,
		]) {
			expect(recipeOpenedFromUrl(url, url)).toBeUndefined();
		}
		expect(recipeOpenedFromUrl('favorites', 'favorites')).toBeUndefined();
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
