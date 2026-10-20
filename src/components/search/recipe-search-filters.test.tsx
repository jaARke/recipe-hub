import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import { page, userEvent } from 'vitest/browser';
import type { RecipeSearchFacets } from '@/application/ports/recipe-search';
import { noRecipeSearchFacets } from '@/application/testing/fixed-recipe-search';
import { RecipeSearchFilters } from '@/components/search/recipe-search-filters';
import type { RecipeSearchState } from '@/components/search/search-params';
import { memberIdSchema } from '@/domain/member/member';

const facets: RecipeSearchFacets = {
	chapters: { ...noRecipeSearchFacets.chapters, 'breads-rolls': 2, desserts: 3 },
	holidays: { ...noRecipeSearchFacets.holidays, thanksgiving: 1, christmas: 2 },
	diets: { ...noRecipeSearchFacets.diets, vegetarian: 4, 'gluten-free': 1 },
	sources: [{ label: 'Joy of Cooking', count: 3 }],
	contributors: [
		{
			memberId: memberIdSchema.parse('7b6f8e64-2d0a-4b9e-9a51-0f6d2c3a8e11'),
			displayName: 'Barb',
			count: 5,
		},
	],
};

function filters(state: RecipeSearchState, searchFacets = facets) {
	return <RecipeSearchFilters idPrefix="filters" state={state} facets={searchFacets} />;
}

async function renderFilters(state: RecipeSearchState, searchFacets = facets) {
	await render(filters(state, searchFacets));
}

function form() {
	return document.querySelector('form') as HTMLFormElement;
}

// What the form would submit, which next/form turns into the URL's query in this order.
function submittedQuery() {
	return new URLSearchParams([...new FormData(form())] as [string, string][]).toString();
}

// The checkboxes a group offers, each as its label reads.
function offered(group: string) {
	const checkboxes = page.getByRole('group', { name: group }).element();
	return Array.from(checkboxes.querySelectorAll('label'), (label) => label.textContent);
}

// The chapters the select offers, each as its option reads, closing it again.
async function offeredChapters() {
	await page.getByRole('combobox', { name: 'Chapter' }).click();
	await expect.element(page.getByRole('option', { name: 'Any chapter' })).toBeVisible();
	const options = page
		.getByRole('option')
		.elements()
		.map((option) => option.textContent);
	await userEvent.keyboard('{Escape}');
	return options;
}

async function choose(field: string, option: string) {
	await page.getByRole('combobox', { name: field }).click();
	await page.getByRole('option', { name: option }).click();
}

describe('RecipeSearchFilters', () => {
	it('submits only the holiday chosen, after the search it refines, with no field left at any', async () => {
		await renderFilters({ text: 'butter', holidays: [], diets: [], sort: 'newest', page: 2 });

		await page.getByRole('checkbox', { name: 'Christmas 2' }).click();

		expect(submittedQuery()).toBe('q=butter&sort=newest&holiday=christmas');
	});

	it('submits a choice made, and nothing for it once it is back at any', async () => {
		await renderFilters({ holidays: [], diets: [], sort: 'newest', page: 1 });

		await choose('Chapter', 'Desserts 3');
		await page.getByRole('checkbox', { name: 'Gluten-free 1' }).click();
		await choose('Source', 'Joy of Cooking 3');
		await choose('Total time', '30 minutes or less');
		expect(submittedQuery()).toBe(
			'chapter=desserts&diet=gluten-free&source=Joy+of+Cooking&time=30'
		);

		await choose('Chapter', 'Any chapter');
		await choose('Source', 'Any source');
		expect(submittedQuery()).toBe('diet=gluten-free&time=30');
	});

	it('submits the filters the search already holds until one is set back to any', async () => {
		await renderFilters({
			chapter: 'desserts',
			holidays: ['christmas'],
			diets: ['vegetarian'],
			contributorId: '7b6f8e64-2d0a-4b9e-9a51-0f6d2c3a8e11',
			addedWithin: 'month',
			sort: 'title',
			page: 1,
		});
		expect(submittedQuery()).toBe(
			'sort=title&chapter=desserts&holiday=christmas&diet=vegetarian&contributor=7b6f8e64-2d0a-4b9e-9a51-0f6d2c3a8e11&added=month'
		);

		await choose('Chapter', 'Any chapter');
		await page.getByRole('checkbox', { name: 'Christmas 2' }).click();
		await choose('Added by', 'Anyone');
		await choose('Date added', 'Any time');

		expect(submittedQuery()).toBe('sort=title&diet=vegetarian');
	});

	it('submits to Browse without words and to Search with them', async () => {
		const { rerender } = await render(
			filters({ holidays: [], diets: [], sort: 'newest', page: 1 })
		);
		expect(form().getAttribute('action')).toBe('/');

		await rerender(
			filters({ text: 'butter', holidays: [], diets: [], sort: 'relevance', page: 1 })
		);
		expect(form().getAttribute('action')).toBe('/search');
	});

	it('offers the chapters, holidays, and diets with recipes to count, in the vocabulary’s order', async () => {
		await renderFilters({ holidays: [], diets: [], sort: 'newest', page: 1 });

		expect(offered('Holidays')).toEqual(['Thanksgiving 1', 'Christmas 2']);
		expect(offered('Diet')).toEqual(['Vegetarian 4', 'Gluten-free 1']);
		expect(await offeredChapters()).toEqual(['Any chapter', 'Breads & Rolls 2', 'Desserts 3']);
	});

	it('keeps a chosen chapter, holiday, and diet at zero, so each can be cleared', async () => {
		await renderFilters({
			chapter: 'main-dishes',
			holidays: ['easter'],
			diets: ['vegan'],
			sort: 'newest',
			page: 1,
		});

		expect(offered('Holidays')).toEqual(['Easter 0', 'Thanksgiving 1', 'Christmas 2']);
		await expect.element(page.getByRole('checkbox', { name: 'Easter 0' })).toBeChecked();
		expect(offered('Diet')).toEqual(['Vegetarian 4', 'Vegan 0', 'Gluten-free 1']);
		await expect.element(page.getByRole('checkbox', { name: 'Vegan 0' })).toBeChecked();
		expect(await offeredChapters()).toEqual([
			'Any chapter',
			'Main Dishes 0',
			'Breads & Rolls 2',
			'Desserts 3',
		]);
	});

	it('leaves out a group with nothing to offer', async () => {
		await renderFilters(
			{ holidays: [], diets: [], sort: 'newest', page: 1 },
			{ ...facets, holidays: noRecipeSearchFacets.holidays }
		);

		await expect.element(page.getByRole('group', { name: 'Holidays' })).not.toBeInTheDocument();
		await expect.element(page.getByRole('group', { name: 'Diet' })).toBeVisible();
	});

	it('keeps choices not yet applied when the order changes, and shows new filters as they apply', async () => {
		const state: RecipeSearchState = { holidays: [], diets: [], sort: 'newest', page: 1 };
		const { rerender } = await render(filters(state));
		await page.getByRole('checkbox', { name: 'Christmas 2' }).click();
		await choose('Total time', '30 minutes or less');

		await rerender(filters({ ...state, sort: 'title' }));

		await expect.element(page.getByRole('checkbox', { name: 'Christmas 2' })).toBeChecked();
		expect(submittedQuery()).toBe('sort=title&holiday=christmas&time=30');

		await rerender(filters({ ...state, holidays: ['thanksgiving'], sort: 'title' }));

		await expect.element(page.getByRole('checkbox', { name: 'Thanksgiving 1' })).toBeChecked();
		await expect.element(page.getByRole('checkbox', { name: 'Christmas 2' })).not.toBeChecked();
		expect(submittedQuery()).toBe('sort=title&holiday=thanksgiving');
	});
});
