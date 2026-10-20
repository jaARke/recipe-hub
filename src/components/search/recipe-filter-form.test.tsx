import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import { page, userEvent } from 'vitest/browser';
import type { RecipeSearchFacets } from '@/application/ports/recipe-search';
import { noRecipeSearchFacets } from '@/application/testing/fixed-recipe-search';
import { holdPageLoads } from '@/components/auth/testing/page-loads';
import { RecipeFilterSidebar } from '@/components/search/recipe-filter-form';
import {
	recipeFilterCarriedParams,
	recipeFilterGroups,
} from '@/components/search/recipe-filter-groups';
import {
	appliedFilterCount,
	recipeSearchHref,
	recipesView,
	withoutFilters,
	type RecipeSearchState,
} from '@/components/search/search-params';
import { memberIdSchema } from '@/domain/member/member';

const adaId = memberIdSchema.parse('0199c7a4-2c3e-7b1a-9f00-2a7c1e4b5d6e');

// Six recipes from eight sources, so Recipe from folds its last three, with no Easter recipe among
// the vegan ones.
const facets: RecipeSearchFacets = {
	...noRecipeSearchFacets,
	allRecipes: 6,
	holidays: { ...noRecipeSearchFacets.holidays, easter: 2, christmas: 3 },
	diets: { ...noRecipeSearchFacets.diets, vegetarian: 4, vegan: 1 },
	totalTimes: { 15: 1, 30: 2, 60: 5, 120: 6 },
	sources: Array.from({ length: 8 }, (_, index) => ({ label: `Cook ${index + 1}`, count: 1 })),
	contributors: [{ memberId: adaId, displayName: 'Ada', count: 6 }],
};

const veganFacets: RecipeSearchFacets = {
	...facets,
	holidays: { ...facets.holidays, easter: 0 },
};

// As the page composes it for the view.
function sidebar(state: RecipeSearchState, searchFacets = facets) {
	return (
		<RecipeFilterSidebar
			groups={recipeFilterGroups(state, searchFacets)}
			carriedParams={recipeFilterCarriedParams(state)}
			clearAllHref={
				appliedFilterCount(state) > 0 ? recipeSearchHref(withoutFilters(state)) : undefined
			}
		/>
	);
}

function checkbox(name: string) {
	return page.getByRole('checkbox', { name });
}

function radio(name: string) {
	return page.getByRole('radio', { name });
}

function moreNames() {
	return page.getByText('More names (3)');
}

describe('RecipeFilterSidebar', () => {
	it('offers Sort by and each filter, every option with what choosing it would show', async () => {
		await render(sidebar(recipesView()));

		await expect.element(page.getByRole('region', { name: 'Filter and sort' })).toBeInTheDocument();
		await expect.element(page.getByRole('radiogroup', { name: 'Sort by' })).toBeInTheDocument();
		await expect.element(radio('Newest first')).toBeChecked();
		await expect.element(page.getByRole('group', { name: 'Holidays' })).toBeInTheDocument();
		await expect.element(checkbox('Easter (2)')).not.toBeChecked();
		await expect.element(radio('Any length')).toBeChecked();
		await expect.element(radio('1 hour or less (5)')).not.toBeChecked();
		await expect.element(radio('Anyone')).toBeChecked();
		await expect.element(radio('Any member')).toBeChecked();
	});

	it('goes to the view with a box ticked, focus still on the box', async () => {
		const loads = holdPageLoads();
		const { rerender } = await render(sidebar(recipesView()));

		await checkbox('Easter (2)').click();
		// The view the form leads to, which a navigation would render.
		await rerender(sidebar({ ...recipesView(), holidays: ['easter'] }));

		await expect.poll(() => loads).toEqual([{ path: '/?holiday=easter', type: 'push' }]);
		await expect.element(checkbox('Easter (2)')).toBeChecked();
		await expect.element(checkbox('Easter (2)')).toHaveFocus();
	});

	it('carries the words and the chapter, from the first page', async () => {
		const loads = holdPageLoads();
		await render(
			sidebar({ ...recipesView('desserts'), text: 'lemon', sort: 'relevance', page: 2 })
		);

		await checkbox('Christmas (3)').click();

		await expect
			.poll(() => loads)
			.toEqual([{ path: '/?q=lemon&chapter=desserts&holiday=christmas', type: 'push' }]);
	});

	it('submits nothing for an any choice or the view’s own order', async () => {
		const loads = holdPageLoads();
		const timedAToZ: RecipeSearchState = { ...recipesView(), maxTotalMinutes: 30, sort: 'title' };
		const { rerender } = await render(sidebar(timedAToZ));

		await radio('Any length').click();
		await rerender(sidebar({ ...timedAToZ, maxTotalMinutes: undefined }));
		await radio('Newest first').click();

		await expect
			.poll(() => loads)
			.toEqual([
				{ path: '/?sort=title', type: 'push' },
				{ path: '/', type: 'push' },
			]);
	});

	it('disables an option at zero unless the view chooses it', async () => {
		const loads = holdPageLoads();
		await render(
			sidebar(
				{ ...recipesView(), diets: ['vegan'], source: 'Grandma Rose' },
				{ ...veganFacets, sources: [{ label: 'Cook 1', count: 0 }] }
			)
		);

		await expect.element(checkbox('Easter (0)')).toHaveAttribute('aria-disabled', 'true');
		await expect.element(checkbox('Christmas (3)')).not.toHaveAttribute('aria-disabled');
		await expect.element(radio('Cook 1 (0)')).toHaveAttribute('aria-disabled', 'true');
		// Chosen, at zero, so it can be cleared.
		await expect.element(radio('Grandma Rose (0)')).toBeChecked();
		await expect.element(radio('Grandma Rose (0)')).not.toHaveAttribute('aria-disabled');

		await checkbox('Easter (0)').click({ force: true });

		expect(loads).toEqual([]);
		await expect.element(checkbox('Easter (0)')).not.toBeChecked();
	});

	it('leaves focus on a box let go at zero, which the next view disables', async () => {
		const loads = holdPageLoads();
		const veganEaster: RecipeSearchState = {
			...recipesView(),
			holidays: ['easter'],
			diets: ['vegan'],
		};
		const { rerender } = await render(sidebar(veganEaster, veganFacets));
		await expect.element(checkbox('Easter (0)')).not.toHaveAttribute('aria-disabled');

		await checkbox('Easter (0)').click();
		await rerender(sidebar({ ...veganEaster, holidays: [] }, veganFacets));

		await expect.poll(() => loads).toEqual([{ path: '/?diet=vegan', type: 'push' }]);
		await expect.element(checkbox('Easter (0)')).toHaveAttribute('aria-disabled', 'true');
		await expect.element(checkbox('Easter (0)')).toHaveFocus();

		// Tab goes on to the next box enabled.
		await userEvent.keyboard('{Tab}');

		await expect.element(checkbox('Christmas (3)')).toHaveFocus();
	});

	it('folds Recipe from after its first six options, and opens the fold to choose inside it', async () => {
		await render(sidebar(recipesView()));

		await expect.element(radio('Cook 5 (1)')).toBeVisible();
		// A closed fold's options are hidden, so no role finds them.
		await expect.element(radio('Cook 6 (1)')).not.toBeInTheDocument();

		await moreNames().click();

		await expect.element(radio('Cook 6 (1)')).toBeVisible();
		await expect.element(radio('Cook 8 (1)')).toBeVisible();

		await moreNames().click();

		await expect.element(radio('Cook 6 (1)')).not.toBeInTheDocument();
	});

	it('opens the fold on its own when the view chooses a source inside it', async () => {
		await render(sidebar({ ...recipesView(), source: 'Cook 7' }));

		await expect.element(radio('Cook 7 (1)')).toBeVisible();
		await expect.element(radio('Cook 7 (1)')).toBeChecked();
	});

	it('keeps focus on a source chosen inside the fold, which stays open', async () => {
		const loads = holdPageLoads();
		const { rerender } = await render(sidebar(recipesView()));
		await moreNames().click();

		await radio('Cook 7 (1)').click();
		await rerender(sidebar({ ...recipesView(), source: 'Cook 7' }));

		await expect.poll(() => loads).toEqual([{ path: '/?source=Cook+7', type: 'push' }]);
		await expect.element(radio('Cook 7 (1)')).toBeChecked();
		await expect.element(radio('Cook 7 (1)')).toHaveFocus();
		await expect.element(radio('Cook 8 (1)')).toBeVisible();
	});

	it('offers Clear all once a filter applies, keeping the words, the chapter, and the order', async () => {
		const { rerender } = await render(sidebar({ ...recipesView('desserts'), sort: 'newest' }));

		await expect.element(page.getByRole('link', { name: 'Clear all' })).not.toBeInTheDocument();

		await rerender(
			sidebar({
				...recipesView('desserts'),
				holidays: ['christmas'],
				maxTotalMinutes: 60,
				sort: 'newest',
			})
		);

		await expect
			.element(page.getByRole('link', { name: 'Clear all' }))
			.toHaveAttribute('href', '/?chapter=desserts&sort=newest');
	});
});
