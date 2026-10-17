import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import type { RecipeSearchFacets } from '@/application/ports/recipe-search';
import { RecipeSearchFilters } from '@/components/search/recipe-search-filters';
import type { RecipeSearchState } from '@/components/search/search-params';
import { memberIdSchema } from '@/domain/member/member';

// Counted over five results, none of which carries every tag.
const total = 5;

const facets: RecipeSearchFacets = {
	tags: [
		{ label: 'Baking', count: 4 },
		{ label: 'Dessert', count: 2 },
	],
	sources: [{ label: 'Joy of Cooking', count: 3 }],
	contributors: [
		{
			memberId: memberIdSchema.parse('7b6f8e64-2d0a-4b9e-9a51-0f6d2c3a8e11'),
			displayName: 'Barb',
			count: 5,
		},
	],
};

function filters(state: RecipeSearchState, searchFacets = facets, searchTotal = total) {
	return (
		<RecipeSearchFilters
			idPrefix="filters"
			state={state}
			facets={searchFacets}
			total={searchTotal}
		/>
	);
}

async function renderFilters(state: RecipeSearchState) {
	await render(filters(state));
}

function form() {
	return document.querySelector('form') as HTMLFormElement;
}

// What the form would submit, which next/form turns into the URL's query in this order.
function submittedQuery() {
	return new URLSearchParams([...new FormData(form())] as [string, string][]).toString();
}

// The tags on offer, each as its label reads.
function offeredTags() {
	const tags = page.getByRole('group', { name: 'Tags' }).element();
	return Array.from(tags.querySelectorAll('label'), (label) => label.textContent);
}

async function choose(field: string, option: string) {
	await page.getByRole('combobox', { name: field }).click();
	await page.getByRole('option', { name: option }).click();
}

describe('RecipeSearchFilters', () => {
	it('submits only the tag chosen, after the search it refines, with no field left at any', async () => {
		await renderFilters({ text: 'butter', tags: [], sort: 'newest', page: 2 });

		await page.getByRole('checkbox', { name: 'Baking 4' }).click();

		expect(submittedQuery()).toBe('q=butter&sort=newest&tag=Baking');
	});

	it('submits a choice made, and nothing for it once it is back at any', async () => {
		await renderFilters({ tags: [], sort: 'newest', page: 1 });

		await choose('Source', 'Joy of Cooking 3');
		await choose('Total time', '30 minutes or less');
		expect(submittedQuery()).toBe('source=Joy+of+Cooking&time=30');

		await choose('Source', 'Any source');
		expect(submittedQuery()).toBe('time=30');
	});

	it('submits the filters the search already holds until one is set back to any', async () => {
		await renderFilters({
			tags: ['Dessert'],
			contributorId: '7b6f8e64-2d0a-4b9e-9a51-0f6d2c3a8e11',
			addedWithin: 'month',
			sort: 'title',
			page: 1,
		});
		expect(submittedQuery()).toBe(
			'sort=title&tag=Dessert&contributor=7b6f8e64-2d0a-4b9e-9a51-0f6d2c3a8e11&added=month'
		);

		await choose('Added by', 'Anyone');
		await choose('Date added', 'Any time');

		expect(submittedQuery()).toBe('sort=title&tag=Dessert');
	});

	it('submits to Browse without words and to Search with them', async () => {
		const { rerender } = await render(filters({ tags: [], sort: 'newest', page: 1 }));
		expect(form().getAttribute('action')).toBe('/');

		await rerender(filters({ text: 'butter', tags: [], sort: 'relevance', page: 1 }));
		expect(form().getAttribute('action')).toBe('/search');
	});

	it('offers the tags that narrow the results, none that every result has', async () => {
		await render(
			filters(
				{ tags: [], sort: 'newest', page: 1 },
				{
					...facets,
					tags: [
						{ label: 'Dessert', count: 2 },
						{ label: 'Make ahead', count: 2 },
						{ label: 'Français', count: 1 },
					],
				},
				2
			)
		);

		expect(offeredTags()).toEqual(['Français 1']);
	});

	it('keeps a checked tag that every result has, so it can be cleared', async () => {
		await render(
			filters(
				{ tags: ['Dessert', 'Make ahead'], sort: 'newest', page: 1 },
				{
					...facets,
					tags: [
						{ label: 'Dessert', count: 2 },
						{ label: 'Make ahead', count: 2 },
						{ label: 'Baking', count: 2 },
						{ label: 'Français', count: 1 },
					],
				},
				2
			)
		);

		expect(offeredTags()).toEqual(['Dessert 2', 'Make ahead 2', 'Français 1']);
		await expect.element(page.getByRole('checkbox', { name: 'Dessert 2' })).toBeChecked();
	});

	it('keeps choices not yet applied when the order changes, and shows new filters as they apply', async () => {
		const state: RecipeSearchState = { tags: [], sort: 'newest', page: 1 };
		const { rerender } = await render(filters(state));
		await page.getByRole('checkbox', { name: 'Dessert 2' }).click();
		await choose('Total time', '30 minutes or less');

		await rerender(filters({ ...state, sort: 'title' }));

		await expect.element(page.getByRole('checkbox', { name: 'Dessert 2' })).toBeChecked();
		expect(submittedQuery()).toBe('sort=title&tag=Dessert&time=30');

		await rerender(filters({ ...state, tags: ['Baking'], sort: 'title' }));

		await expect.element(page.getByRole('checkbox', { name: 'Baking 4' })).toBeChecked();
		await expect.element(page.getByRole('checkbox', { name: 'Dessert 2' })).not.toBeChecked();
		expect(submittedQuery()).toBe('sort=title&tag=Baking');
	});
});
