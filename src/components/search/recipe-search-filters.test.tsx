import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import type { RecipeSearchFacets } from '@/application/ports/recipe-search';
import { RecipeSearchFilters } from '@/components/search/recipe-search-filters';
import type { RecipeSearchState } from '@/components/search/search-params';
import { memberIdSchema } from '@/domain/member/member';

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

async function renderFilters(state: RecipeSearchState) {
	await render(<RecipeSearchFilters idPrefix="filters" state={state} facets={facets} />);
}

// What the form would submit, which next/form turns into the URL's query in this order.
function submittedQuery() {
	const form = document.querySelector('form') as HTMLFormElement;
	return new URLSearchParams([...new FormData(form)] as [string, string][]).toString();
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
});
