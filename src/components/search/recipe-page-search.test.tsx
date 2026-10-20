import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import { page, userEvent } from 'vitest/browser';
import { holdPageLoads } from '@/components/auth/testing/page-loads';
import { RecipePageSearch } from '@/components/search/recipe-page-search';
import type { RecipeSearchState } from '@/components/search/search-params';

const allRecipes: RecipeSearchState = { holidays: [], diets: [], sort: 'newest', page: 1 };

// Desserts filtered by Christmas and vegetarian, newest first rather than the chapter's A to Z, on
// its second page.
const filteredDesserts: RecipeSearchState = {
	chapter: 'desserts',
	holidays: ['christmas'],
	diets: ['vegetarian'],
	sort: 'newest',
	page: 2,
};

function pageSearch(state: RecipeSearchState) {
	return <RecipePageSearch id="recipes-search" state={state} />;
}

function searchField(name: string) {
	return page.getByRole('searchbox', { name });
}

function clearSearch() {
	return page.getByRole('link', { name: 'Clear search' });
}

describe('RecipePageSearch', () => {
	it('names the view it searches, offering no × without words', async () => {
		const { container, rerender } = await render(pageSearch(allRecipes));
		// Vitest's roles leave out the search element, so its landmark is found by its tag.
		const landmark = page.elementLocator(container.querySelector('search') ?? container);

		await expect.element(landmark).toHaveAccessibleName('Search All Recipes');
		await expect.element(searchField('Search All Recipes')).toHaveValue('');
		await expect.element(clearSearch()).not.toBeInTheDocument();

		await rerender(pageSearch(filteredDesserts));

		await expect.element(landmark).toHaveAccessibleName('Search Desserts');
		await expect.element(searchField('Search Desserts')).toBeVisible();
		await expect.element(clearSearch()).not.toBeInTheDocument();
	});

	it('searches within the chapter and filters by best match, from the first page', async () => {
		const loads = holdPageLoads();
		await render(pageSearch(filteredDesserts));

		await searchField('Search Desserts').fill('lemon');
		await page.getByRole('button', { name: 'Search' }).click();

		await expect
			.poll(() => loads)
			.toEqual([
				{ path: '/?q=lemon&chapter=desserts&holiday=christmas&diet=vegetarian', type: 'push' },
			]);
	});

	it('keeps the words in the field, to be refined', async () => {
		const loads = holdPageLoads();
		await render(
			pageSearch({
				text: 'tomato',
				chapter: 'soups-salads',
				holidays: [],
				diets: [],
				sort: 'relevance',
				page: 1,
			})
		);
		const field = searchField('Search Soups & Salads');
		await expect.element(field).toHaveValue('tomato');

		await field.fill('tomato basil');
		await userEvent.keyboard('{Enter}');

		await expect
			.poll(() => loads)
			.toEqual([{ path: '/?q=tomato+basil&chapter=soups-salads', type: 'push' }]);
	});

	it('clears only the words with its ×, leaving focus in the emptied field', async () => {
		const loads = holdPageLoads();
		const { rerender } = await render(pageSearch({ ...filteredDesserts, text: 'lemon' }));

		await clearSearch().click();
		// The view the × leads to, which a navigation would render.
		await rerender(pageSearch({ ...filteredDesserts, page: 1 }));

		await expect
			.poll(() => loads)
			.toEqual([
				{ path: '/?chapter=desserts&holiday=christmas&diet=vegetarian&sort=newest', type: 'push' },
			]);
		await expect.element(searchField('Search Desserts')).toHaveFocus();
		await expect.element(searchField('Search Desserts')).toHaveValue('');
		await expect.element(clearSearch()).not.toBeInTheDocument();
	});
});
