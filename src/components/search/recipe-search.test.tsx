import { beforeEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import type { RecipeSearchFacets } from '@/application/ports/recipe-search';
import type { RecipeSearchPage } from '@/application/search/recipe-search-dtos';
import { RecipeSearch } from '@/components/search/recipe-search';
import type { RecipeSearchState } from '@/components/search/search-params';
import { recipeIdSchema } from '@/domain/recipe/recipe';

// Tailwind's lg breakpoint, from which the filters sit in a sidebar.
const lgViewport = { width: 1024, height: 768 };

// Browse's own heading, which heads its cards as the page's h1 does.
const browseHeadingId = 'recipes-heading';

const facets: RecipeSearchFacets = {
	tags: [
		{ label: 'Dessert', count: 2 },
		{ label: 'Make ahead', count: 1 },
	],
	sources: [],
	contributors: [],
};

function results(titles: readonly string[]): RecipeSearchPage {
	return {
		results: titles.map((title, index) => ({
			recipe: {
				id: recipeIdSchema.parse(`0199c7a4-2c3e-7b1a-9f00-00000000000${index + 1}`),
				slug: title.toLowerCase().replaceAll(' ', '-'),
				title,
				chapter: 'desserts',
				holidays: [],
				diets: [],
				tags: ['Dessert'],
				createdAt: new Date('2026-10-01T12:00:00.000Z'),
			},
			title: [{ text: title, highlighted: false }],
		})),
		total: titles.length,
		match: 'exact',
		facets: titles.length === 0 ? { ...facets, tags: [] } : facets,
	};
}

const desserts = results(['Lemon bars', 'Peach cobbler']);

// The page around the list: Browse's heading, or Search's, whose results take a heading of their own.
function searchPage(state: RecipeSearchState, found: RecipeSearchPage = desserts) {
	return state.text === undefined ? (
		<>
			<h1 id={browseHeadingId} tabIndex={-1}>
				Recipes
			</h1>
			<RecipeSearch
				state={state}
				results={found}
				pageCount={1}
				headingLevel={2}
				resultsHeadingId={browseHeadingId}
			/>
		</>
	) : (
		<>
			<h1>Search</h1>
			<RecipeSearch state={state} results={found} pageCount={1} headingLevel={2} />
		</>
	);
}

function activeFilterLinks() {
	return page
		.getByRole('list', { name: 'Active filters' })
		.getByRole('link')
		.elements()
		.map((link) => [link.textContent, link.getAttribute('href')]);
}

function clearFilters() {
	return page.getByRole('link', { name: 'Clear filters' });
}

function filtersButton({ includeHidden = false } = {}) {
	return page.getByRole('button', { name: /^Filters/, includeHidden });
}

function sidebarHeading({ includeHidden = false } = {}) {
	return page.getByRole('heading', { name: 'Filters', includeHidden });
}

describe('RecipeSearch', () => {
	it('lists Browse’s cards under its heading, with the filters behind Filters below lg', async () => {
		await render(searchPage({ tags: [], sort: 'newest', page: 1 }));

		await expect.element(filtersButton()).toBeVisible();
		await expect.element(sidebarHeading({ includeHidden: true })).not.toBeVisible();
		await expect
			.element(
				page.getByRole('region', { name: 'Recipes' }).getByRole('link', { name: 'Lemon bars' })
			)
			.toBeVisible();
		await expect
			.element(page.getByRole('heading', { name: 'Lemon bars', level: 2 }))
			.toBeInTheDocument();
	});

	describe('from lg', () => {
		beforeEach(async () => {
			await page.viewport(lgViewport.width, lgViewport.height);
		});

		it('sets the filters in a sidebar beside the results, with no Filters button', async () => {
			await render(searchPage({ tags: [], sort: 'newest', page: 1 }));

			await expect.element(sidebarHeading()).toBeVisible();
			await expect.element(filtersButton({ includeHidden: true })).not.toBeVisible();
			const sidebar = sidebarHeading().element().getBoundingClientRect();
			const cards = page
				.getByRole('link', { name: 'Lemon bars' })
				.element()
				.getBoundingClientRect();
			expect(sidebar.right).toBeLessThanOrEqual(cards.left);
		});

		it('leaves focus on Apply filters when the filters it applied come back', async () => {
			const state: RecipeSearchState = { tags: [], sort: 'newest', page: 1 };
			const { rerender } = await render(searchPage(state));
			const apply = page.getByRole('button', { name: 'Apply filters' });
			apply.element().focus();

			await rerender(searchPage({ ...state, tags: ['Dessert'] }));

			await expect.element(apply).toHaveFocus();
		});
	});

	it('removes each of Browse’s filters with its chip, and all of them with Clear filters, from the first page', async () => {
		await render(searchPage({ tags: ['Dessert', 'Make ahead'], sort: 'title', page: 2 }));

		expect(activeFilterLinks()).toEqual([
			['Remove Dessert', '/?tag=Make+ahead&sort=title'],
			['Remove Make ahead', '/?tag=Dessert&sort=title'],
		]);
		await expect.element(clearFilters()).toHaveAttribute('href', '/?sort=title');
	});

	it('leads with the words on Search, whose chip returns to Browse with the filters', async () => {
		await render(searchPage({ text: 'lemon', tags: ['Dessert'], sort: 'relevance', page: 1 }));

		expect(activeFilterLinks()).toEqual([
			['Remove “lemon”', '/?tag=Dessert'],
			['Remove Dessert', '/search?q=lemon'],
		]);
		await expect.element(clearFilters()).toHaveAttribute('href', '/search?q=lemon');
	});

	it('keeps the order with the filters as the words leave, unless it was best match', async () => {
		await render(searchPage({ text: 'lemon', tags: ['Dessert'], sort: 'title', page: 1 }));

		await expect
			.element(page.getByRole('link', { name: 'Remove “lemon”' }))
			.toHaveAttribute('href', '/?tag=Dessert&sort=title');
	});

	it('offers no Clear filters for the words alone', async () => {
		await render(searchPage({ text: 'lemon', tags: [], sort: 'relevance', page: 1 }));

		expect(activeFilterLinks()).toEqual([['Remove “lemon”', '/']]);
		await expect.element(clearFilters()).not.toBeInTheDocument();
	});

	it('clears the filters from an empty list, staying in its mode', async () => {
		const { rerender } = await render(
			searchPage({ tags: ['Soup', 'Dessert'], sort: 'newest', page: 1 }, results([]))
		);
		const emptyState = page.getByRole('link', { name: 'Clear filters' }).last();

		await expect.element(page.getByText('No recipes match these filters')).toBeVisible();
		await expect.element(emptyState).toHaveAttribute('href', '/');

		await rerender(
			searchPage({ text: 'kumquat', tags: ['Dessert'], sort: 'relevance', page: 1 }, results([]))
		);

		await expect
			.element(page.getByText('No recipes match “kumquat” with these filters'))
			.toBeVisible();
		await expect.element(emptyState).toHaveAttribute('href', '/search?q=kumquat');
	});

	it('moves focus to Browse’s heading when a removed chip takes it along', async () => {
		const { rerender } = await render(
			searchPage({ tags: ['Dessert', 'Make ahead'], sort: 'newest', page: 1 })
		);
		page.getByRole('link', { name: 'Remove Dessert' }).element().focus();

		await rerender(searchPage({ tags: ['Make ahead'], sort: 'newest', page: 1 }));

		await expect.element(page.getByRole('heading', { name: 'Recipes', level: 1 })).toHaveFocus();
	});

	it('moves focus to Search’s results when Clear filters takes it along', async () => {
		const { rerender } = await render(
			searchPage({ text: 'lemon', tags: ['Dessert'], sort: 'relevance', page: 1 })
		);
		clearFilters().element().focus();

		await rerender(searchPage({ text: 'lemon', tags: [], sort: 'relevance', page: 1 }));

		await expect.element(page.getByRole('heading', { name: 'Results', level: 2 })).toHaveFocus();
	});
});
