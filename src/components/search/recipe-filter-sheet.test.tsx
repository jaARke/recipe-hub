import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { page, userEvent } from 'vitest/browser';
import type { RecipeSearchFacets } from '@/application/ports/recipe-search';
import { noRecipeSearchFacets } from '@/application/testing/fixed-recipe-search';
import { holdPageLoads } from '@/components/auth/testing/page-loads';
import {
	recipeFilterCarriedParams,
	recipeFilterGroups,
} from '@/components/search/recipe-filter-groups';
import { RecipeFilterSheet } from '@/components/search/recipe-filter-sheet';
import {
	appliedFilterCount,
	recipesView,
	type RecipeSearchState,
} from '@/components/search/search-params';

afterEach(() => {
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

// Six recipes from eight sources, so Recipe from folds its last three.
const facets: RecipeSearchFacets = {
	...noRecipeSearchFacets,
	allRecipes: 6,
	holidays: { ...noRecipeSearchFacets.holidays, easter: 2, christmas: 3 },
	diets: { ...noRecipeSearchFacets.diets, vegetarian: 4, vegan: 1 },
	totalTimes: { 15: 1, 30: 2, 60: 5, 120: 6 },
	sources: Array.from({ length: 8 }, (_, index) => ({ label: `Cook ${index + 1}`, count: 1 })),
};

const headingId = 'recipes-heading';

// As the page composes it, below the view's heading.
function filterSheet(state: RecipeSearchState, total = 6, searchFacets = facets) {
	return (
		<>
			<h1 id={headingId} tabIndex={-1}>
				All Recipes
			</h1>
			<RecipeFilterSheet
				groups={recipeFilterGroups(state, searchFacets)}
				tally={{ total, counts: searchFacets }}
				carriedParams={recipeFilterCarriedParams(state)}
				appliedCount={appliedFilterCount(state)}
				headingId={headingId}
			/>
		</>
	);
}

// A request for counts, held until the test answers it.
type HeldCount = {
	// From its path on.
	path: string;
	signal: AbortSignal;
	answer: (total: number, counts?: Partial<RecipeSearchFacets>) => void;
	fail: (status: number) => void;
};

// Holds every request to the counts route, as a fetch that answers only when told, and only through
// the test, even after its request is cancelled. Other requests go through.
function holdCounts(): HeldCount[] {
	const requests: HeldCount[] = [];
	const passThrough = globalThis.fetch;
	vi.stubGlobal('fetch', (input: string, init?: RequestInit) => {
		const url = new URL(input, window.location.href);
		if (url.pathname !== '/api/recipe-counts') {
			return passThrough(input, init);
		}

		return new Promise<Response>((resolve) => {
			requests.push({
				path: `${url.pathname}${url.search}`,
				signal: init?.signal ?? new AbortController().signal,
				answer: (total, counts) =>
					resolve(Response.json({ total, counts: { ...facets, ...counts } })),
				fail: (status) => resolve(new Response(null, { status })),
			});
		});
	});
	return requests;
}

function trigger() {
	return page.getByRole('button', { name: /^Filter and sort/ });
}

function sheet() {
	return page.getByRole('dialog', { name: 'Filter and sort' });
}

function show(name: string) {
	return sheet().getByRole('button', { name });
}

function status() {
	return sheet().getByRole('status');
}

function checkbox(name: string) {
	return sheet().getByRole('checkbox', { name });
}

// After the tasks already queued, such as a render React scheduled, which runs on a message rather
// than a timer.
function afterPendingTasks(): Promise<void> {
	return new Promise((resolve) => {
		const channel = new MessageChannel();
		channel.port1.onmessage = () => {
			channel.port1.close();
			resolve();
		};
		channel.port2.postMessage(null);
	});
}

async function openSheet() {
	await trigger().click();
	await expect.element(sheet()).toBeVisible();
}

describe('RecipeFilterSheet', () => {
	it('counts the filters the view applies on its button', async () => {
		const { rerender } = await render(filterSheet(recipesView()));

		await expect.element(trigger()).toHaveAccessibleName('Filter and sort');

		await rerender(filterSheet({ ...recipesView(), holidays: ['easter'], maxTotalMinutes: 30 }));

		await expect.element(trigger()).toHaveAccessibleName('Filter and sort 2 applied');
	});

	it('opens on the view’s choices in two columns, offering its recipes', async () => {
		const requests = holdCounts();
		await render(filterSheet({ ...recipesView(), holidays: ['christmas'] }, 3));

		await openSheet();

		await expect.element(checkbox('Christmas (3)')).toBeChecked();
		await expect.element(show('Show 3 recipes')).toBeVisible();
		await expect.element(status()).toBeEmptyDOMElement();
		const [first, second] = sheet()
			.getByRole('group', { name: 'Holidays' })
			.getByRole('checkbox')
			.elements()
			.map((box) => box.getBoundingClientRect());
		expect(second?.top).toBe(first?.top);
		expect(second?.left).toBeGreaterThan(first?.right ?? Infinity);
		expect(requests).toEqual([]);
	});

	it('counts the recipes a change would show, without leaving the page', async () => {
		const loads = holdPageLoads();
		const requests = holdCounts();
		await render(filterSheet({ ...recipesView('desserts'), text: 'lemon', sort: 'relevance' }));
		await openSheet();

		await checkbox('Easter (2)').click();

		await expect.element(show('Show recipes')).toBeVisible();
		await expect
			.poll(() => requests.map(({ path }) => path))
			.toEqual(['/api/recipe-counts?q=lemon&chapter=desserts&holiday=easter']);
		requests[0]?.answer(2, { diets: { ...facets.diets, vegetarian: 0 } });

		await expect.element(show('Show 2 recipes')).toBeVisible();
		await expect.element(status()).toHaveTextContent('2 recipes');
		await expect.element(checkbox('Vegetarian (0)')).toHaveAttribute('aria-disabled', 'true');
		await expect.element(checkbox('Easter (2)')).toHaveFocus();
		expect(loads).toEqual([]);
	});

	it('applies with Show, closing on the heading', async () => {
		const loads = holdPageLoads();
		const requests = holdCounts();
		await render(filterSheet(recipesView()));
		await openSheet();
		await checkbox('Easter (2)').click();
		await sheet().getByRole('radio', { name: 'A to Z' }).click();
		await expect.poll(() => requests.length).toBe(1);
		requests[0]?.answer(2);

		await show('Show 2 recipes').click();

		await expect.poll(() => loads).toEqual([{ path: '/?holiday=easter&sort=title', type: 'push' }]);
		await expect.element(sheet()).not.toBeInTheDocument();
		await expect.element(page.getByRole('heading', { name: 'All Recipes' })).toHaveFocus();
	});

	it('closes on the heading without a new page when nothing changed', async () => {
		const loads = holdPageLoads();
		await render(filterSheet(recipesView()));
		await openSheet();

		await show('Show 6 recipes').click();

		await expect.element(sheet()).not.toBeInTheDocument();
		await expect.element(page.getByRole('heading', { name: 'All Recipes' })).toHaveFocus();
		expect(loads).toEqual([]);
	});

	it('still applies when the count fails', async () => {
		const loads = holdPageLoads();
		const requests = holdCounts();
		await render(filterSheet(recipesView()));
		await openSheet();
		await checkbox('Easter (2)').click();
		await expect.poll(() => requests.length).toBe(1);

		requests[0]?.fail(503);

		await expect.element(status()).toHaveTextContent('Couldn’t count the recipes');
		await show('Show recipes').click();
		await expect.poll(() => loads).toEqual([{ path: '/?holiday=easter', type: 'push' }]);
	});

	it('shows only the latest choice’s count when answers arrive in reverse', async () => {
		const requests = holdCounts();
		await render(filterSheet(recipesView()));
		await openSheet();
		await checkbox('Easter (2)').click();
		await expect.poll(() => requests.length).toBe(1);

		await checkbox('Christmas (3)').click();
		await expect.poll(() => requests.length).toBe(2);
		requests[1]?.answer(1);
		await expect.element(show('Show 1 recipe')).toBeVisible();
		requests[0]?.answer(2);

		expect(requests.map(({ path }) => path)).toEqual([
			'/api/recipe-counts?holiday=easter',
			'/api/recipe-counts?holiday=easter&holiday=christmas',
		]);
		expect(requests[0]?.signal.aborted).toBe(true);
		await expect.element(status()).toHaveTextContent('1 recipe');
		await expect.element(show('Show 1 recipe')).toBeVisible();
	});

	it('clears the sheet’s choices with Clear all, never showing a count from before', async () => {
		const requests = holdCounts();
		await render(filterSheet({ ...recipesView(), holidays: ['christmas'] }, 3));
		await openSheet();
		await checkbox('Easter (2)').click();
		await expect.poll(() => requests.length).toBe(1);

		await sheet().getByRole('button', { name: 'Clear all' }).click();
		await expect.poll(() => requests.length).toBe(2);
		requests[0]?.answer(4);

		await expect.element(checkbox('Easter (2)')).not.toBeChecked();
		await expect.element(checkbox('Christmas (3)')).not.toBeChecked();
		await expect.element(show('Show recipes')).toBeVisible();
		expect(requests[1]?.path).toBe('/api/recipe-counts');

		requests[1]?.answer(6);

		await expect.element(show('Show 6 recipes')).toBeVisible();
	});

	it('starts again from the view’s choices when reopened, never showing a count from before', async () => {
		const requests = holdCounts();
		await render(filterSheet(recipesView()));
		await openSheet();
		await checkbox('Easter (2)').click();
		await expect.poll(() => requests.length).toBe(1);

		await userEvent.keyboard('{Escape}');
		await expect.element(sheet()).not.toBeInTheDocument();
		await expect.element(trigger()).toHaveFocus();
		await openSheet();
		requests[0]?.answer(2);

		await expect.element(checkbox('Easter (2)')).not.toBeChecked();
		await expect.element(show('Show 6 recipes')).toBeVisible();
		expect(requests[0]?.signal.aborted).toBe(true);
	});

	it('closes as Back or Forward shows another view, dropping the choices made on the one it left', async () => {
		const requests = holdCounts();
		const { rerender } = await render(filterSheet(recipesView()));
		await openSheet();
		await checkbox('Easter (2)').click();
		await expect.poll(() => requests.length).toBe(1);

		await rerender(filterSheet({ ...recipesView('desserts'), holidays: ['christmas'] }, 3));

		await expect.element(sheet()).not.toBeInTheDocument();
		await expect.element(trigger()).toHaveFocus();
		expect(requests[0]?.signal.aborted).toBe(true);
		await openSheet();
		await expect.element(checkbox('Christmas (3)')).toBeChecked();
		await expect.element(checkbox('Easter (2)')).not.toBeChecked();
		await expect.element(show('Show 3 recipes')).toBeVisible();
	});

	it('leaves focus on a box let go at zero, which it disables', async () => {
		const requests = holdCounts();
		const veganFacets: RecipeSearchFacets = {
			...facets,
			holidays: { ...facets.holidays, easter: 0 },
		};
		await render(
			filterSheet({ ...recipesView(), holidays: ['easter'], diets: ['vegan'] }, 0, veganFacets)
		);
		await openSheet();

		await checkbox('Easter (0)').click();

		await expect.element(checkbox('Easter (0)')).toHaveAttribute('aria-disabled', 'true');
		await expect.element(checkbox('Easter (0)')).toHaveFocus();
		await expect.poll(() => requests.length).toBe(1);
		requests[0]?.answer(1, { holidays: veganFacets.holidays });

		await expect.element(show('Show 1 recipe')).toBeVisible();
		await expect.element(checkbox('Easter (0)')).toHaveAttribute('aria-disabled', 'true');
		await expect.element(checkbox('Easter (0)')).toHaveFocus();
	});

	it('keeps focus on a source chosen inside the fold, which stays open as the count arrives', async () => {
		const requests = holdCounts();
		await render(filterSheet(recipesView()));
		await openSheet();
		await sheet().getByText('More names (3)').click();

		await sheet().getByRole('radio', { name: 'Cook 7 (1)' }).click();
		await expect.poll(() => requests.length).toBe(1);
		requests[0]?.answer(1, { sources: [{ label: 'Cook 7', count: 1 }] });

		await expect.element(show('Show 1 recipe')).toBeVisible();
		await expect.element(sheet().getByRole('radio', { name: 'Cook 7 (1)' })).toHaveFocus();
		await expect.element(sheet().getByRole('radio', { name: 'Cook 8 (0)' })).toBeVisible();
	});

	it('gives up on a count after ten seconds, offering Show without it', async () => {
		holdCounts();
		await render(filterSheet(recipesView()));
		await openSheet();
		// Only while time passes: expect.element polls on the page's own timers.
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
		await checkbox('Easter (2)').click();

		// The debounce, then all but the last moment of the time limit.
		await vi.advanceTimersByTimeAsync(300 + 9_999);
		await afterPendingTasks();

		expect(status().element()).toBeEmptyDOMElement();

		await vi.advanceTimersByTimeAsync(1);
		vi.useRealTimers();

		await expect.element(status()).toHaveTextContent('Couldn’t count the recipes');
		await expect.element(show('Show recipes')).toBeVisible();
	});
});
