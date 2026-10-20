import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import type { RecipeSearchFacets } from '@/application/ports/recipe-search';
import type { RecipeSearchPage } from '@/application/search/recipe-search-dtos';
import { noRecipeSearchFacets } from '@/application/testing/fixed-recipe-search';
import { holdPageLoads } from '@/components/auth/testing/page-loads';
import { readRecipeOpenedFrom } from '@/components/recipe/recipe-opened-from';
import { recipeChapterRows } from '@/components/search/recipe-chapter-rows';
import {
	RecipeSearch,
	RecipesPageGrid,
	RecipesViewHeader,
} from '@/components/search/recipe-search';
import { recipesView, type RecipeSearchState } from '@/components/search/search-params';
import { recipeIdSchema } from '@/domain/recipe/recipe';
import { readTabStorage } from '@/lib/browser-storage';

// Next's bfcacheId for the page's segment, which a new query keeps.
const router = vi.hoisted(() => ({ bfcacheId: 'first-visit' }));

vi.mock('next/navigation', async (importOriginal) => ({
	...(await importOriginal<typeof import('next/navigation')>()),
	useRouter: () => router,
}));

afterEach(() => {
	sessionStorage.clear();
});

// Tailwind's lg breakpoint, from which the sidebar holds the chapters and Filter and sort.
const lgViewport = { width: 1024, height: 768 };

// Two desserts, one of them for Christmas, both vegetarian.
const facets: RecipeSearchFacets = {
	...noRecipeSearchFacets,
	allRecipes: 2,
	chapters: { ...noRecipeSearchFacets.chapters, desserts: 2 },
	holidays: { ...noRecipeSearchFacets.holidays, christmas: 1 },
	diets: { ...noRecipeSearchFacets.diets, vegetarian: 2 },
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
				createdAt: new Date('2026-10-01T12:00:00.000Z'),
			},
			title: [{ text: title, highlighted: false }],
		})),
		total: titles.length,
		match: 'exact',
		facets: titles.length === 0 ? noRecipeSearchFacets : facets,
	};
}

const desserts = results(['Lemon bars', 'Peach cobbler']);

const nothing = results([]);

// The lemon bars as a search for "lemon" finds them, its title and passage marked. Without words,
// search gives the description's opening as the passage, which the list leaves out.
const lemonBars: RecipeSearchPage = {
	...desserts,
	results: desserts.results.map((result, index) =>
		index === 0
			? {
					...result,
					title: [
						{ text: 'Lemon', highlighted: true },
						{ text: ' bars', highlighted: false },
					],
					snippet: [
						{ text: 'Bright ', highlighted: false },
						{ text: 'lemon', highlighted: true },
						{ text: ' curd on shortbread', highlighted: false },
					],
				}
			: result
	),
};

// Desserts searched for lemon among Christmas recipes.
const lemonDesserts: RecipeSearchState = {
	...recipesView('desserts'),
	text: 'lemon',
	holidays: ['christmas'],
	sort: 'relevance',
};

// As the page composes it: the view's header and its results, the chapters read once for both.
function recipesPage(state: RecipeSearchState, found: RecipeSearchPage = desserts, pageCount = 1) {
	const chapterRows = recipeChapterRows(state, found.facets);
	return (
		<RecipesPageGrid>
			<RecipesViewHeader
				idPrefix="recipes"
				state={state}
				chapterRows={Promise.resolve(chapterRows)}
			/>
			<RecipeSearch
				idPrefix="recipes"
				state={state}
				results={found}
				pageCount={pageCount}
				chapterRows={chapterRows}
			/>
		</RecipesPageGrid>
	);
}

function viewHeading() {
	return page.getByRole('heading', { level: 1 });
}

function lemonBarsLink() {
	return page.getByRole('link', { name: 'Lemon bars' });
}

function markedText(): (string | null)[] {
	return Array.from(lemonBarsLink().element().querySelectorAll('mark'), (mark) => mark.textContent);
}

// The results, apart from the header, whose search box has a Clear search of its own.
function resultsRegion() {
	return page.getByRole('region', { name: 'Recipes' });
}

function countLine() {
	return page.getByRole('status');
}

function chipLinks() {
	return page
		.getByRole('list', { name: 'Filtered by:' })
		.getByRole('link')
		.elements()
		.map((link) => [link.textContent, link.getAttribute('href')]);
}

describe('RecipeSearch', () => {
	it('lists the view’s recipes under its heading, with Filter and sort’s button and no sidebar below lg', async () => {
		await render(recipesPage(recipesView()));

		await expect.element(viewHeading()).toHaveAccessibleName('All Recipes');
		await expect.element(page.getByRole('button', { name: /^Filter and sort/ })).toBeVisible();
		await expect
			.element(page.getByRole('heading', { name: 'Chapters', includeHidden: true }))
			.not.toBeVisible();
		await expect
			.element(
				page.getByRole('region', { name: 'Recipes' }).getByRole('link', { name: 'Lemon bars' })
			)
			.toBeVisible();
		await expect
			.element(page.getByRole('heading', { name: 'Lemon bars', level: 3 }))
			.toBeInTheDocument();
	});

	describe('from lg', () => {
		beforeEach(async () => {
			await page.viewport(lgViewport.width, lgViewport.height);
		});

		it('sets the chapters and Filter and sort in a sidebar beside the heading and the results, after the heading in reading order', async () => {
			await render(recipesPage(recipesView()));
			const chapters = page.getByRole('navigation', { name: 'Chapters' });

			await expect.element(chapters).toBeVisible();
			await expect.element(page.getByRole('region', { name: 'Filter and sort' })).toBeVisible();
			await expect
				.element(page.getByRole('button', { name: /^Filter and sort/, includeHidden: true }))
				.not.toBeVisible();
			const sidebar = chapters.element().getBoundingClientRect();
			expect(sidebar.right).toBeLessThanOrEqual(
				viewHeading().element().getBoundingClientRect().left
			);
			expect(sidebar.right).toBeLessThanOrEqual(
				lemonBarsLink().element().getBoundingClientRect().left
			);
			expect(
				viewHeading().element().compareDocumentPosition(chapters.element()) &
					Node.DOCUMENT_POSITION_FOLLOWING
			).toBeTruthy();
		});

		it('moves focus to the heading when the sidebar’s Clear all takes it along', async () => {
			const { rerender } = await render(
				recipesPage({ ...recipesView(), holidays: ['christmas'], diets: ['vegetarian'] })
			);
			page
				.getByRole('region', { name: 'Filter and sort' })
				.getByRole('link', { name: 'Clear all' })
				.element()
				.focus();

			await rerender(recipesPage(recipesView()));

			await expect.element(viewHeading()).toHaveFocus();
		});

		it('leaves focus on a ticked box as the filters it applied come back', async () => {
			const { rerender } = await render(recipesPage(recipesView()));
			const christmas = page.getByRole('checkbox', { name: /^Christmas/ });
			christmas.element().focus();

			await rerender(recipesPage({ ...recipesView(), holidays: ['christmas'] }));

			await expect.element(christmas).toBeChecked();
			await expect.element(christmas).toHaveFocus();
		});
	});

	it('counts the recipes and names the order, with the words when searching', async () => {
		const { rerender } = await render(recipesPage(recipesView('desserts')));

		await expect.element(countLine()).toHaveTextContent('2 recipes, A to Z');

		await rerender(recipesPage({ ...recipesView(), text: 'lemon', sort: 'relevance' }, lemonBars));

		await expect
			.element(countLine())
			.toHaveTextContent('2 recipes matching “lemon”, best match first');
	});

	it('tells screen readers of close matches and the page, which the notice and the pagination show', async () => {
		await render(
			recipesPage(
				{ ...recipesView(), text: 'lemn', sort: 'relevance', page: 2 },
				{ ...lemonBars, match: 'close', total: 30 },
				2
			)
		);

		await expect
			.element(countLine())
			.toHaveTextContent(
				'30 recipes matching “lemn”, close matches, best match first, page 2 of 2'
			);
		await expect
			.element(page.getByText('No exact matches for “lemn”. Showing close matches.'))
			.toBeVisible();
		await expect
			.element(page.getByRole('link', { name: 'Page 1' }))
			.toHaveAttribute('href', '/?q=lemn');
	});

	it('names each recipe’s chapter outside a chapter, and none within one', async () => {
		const { rerender } = await render(recipesPage(recipesView()));

		await expect.element(lemonBarsLink()).toHaveAccessibleDescription('Desserts');

		await rerender(recipesPage(recipesView('desserts')));

		await expect.element(lemonBarsLink()).not.toHaveAccessibleDescription();
	});

	it('marks what the words matched, and shows recipes unmarked with no passage without them', async () => {
		const { rerender } = await render(
			recipesPage({ ...recipesView(), text: 'lemon', sort: 'relevance' }, lemonBars)
		);

		await expect
			.element(lemonBarsLink())
			.toHaveAccessibleDescription('Desserts Bright lemon curd on shortbread');
		expect(markedText()).toEqual(['Lemon', 'lemon']);

		await rerender(recipesPage(recipesView(), lemonBars));

		await expect.element(lemonBarsLink()).toHaveAccessibleDescription('Desserts');
		expect(markedText()).toEqual([]);
	});

	it('leads back to All Recipes from a chapter, keeping the words and the filters', async () => {
		const { rerender } = await render(recipesPage(lemonDesserts, lemonBars));

		await expect
			.element(page.getByRole('link', { name: 'Back to All Recipes' }))
			.toHaveAttribute('href', '/?q=lemon&holiday=christmas');

		await rerender(recipesPage(recipesView()));

		await expect
			.element(page.getByRole('link', { name: 'Back to All Recipes' }))
			.not.toBeInTheDocument();
	});

	it('chips each filter applied, after Filtered by:, removing its own from the first page', async () => {
		await render(
			recipesPage({
				...recipesView('desserts'),
				holidays: ['easter', 'christmas'],
				diets: ['vegetarian'],
				page: 2,
			})
		);

		expect(chipLinks()).toEqual([
			['Remove Easter', '/?chapter=desserts&holiday=christmas&diet=vegetarian'],
			['Remove Christmas', '/?chapter=desserts&holiday=easter&diet=vegetarian'],
			['Remove Vegetarian', '/?chapter=desserts&holiday=easter&holiday=christmas'],
		]);
		await expect
			.element(page.getByRole('link', { name: 'Clear all' }))
			.toHaveAttribute('href', '/?chapter=desserts');
	});

	it('offers Clear all among the chips only once there are two, and chips neither the words nor the chapter', async () => {
		const { rerender } = await render(recipesPage({ ...lemonDesserts, holidays: [] }, lemonBars));

		await expect.element(page.getByRole('list', { name: 'Filtered by:' })).not.toBeInTheDocument();

		await rerender(recipesPage(lemonDesserts, lemonBars));

		expect(chipLinks()).toEqual([['Remove Christmas', '/?q=lemon&chapter=desserts']]);
		await expect.element(page.getByRole('link', { name: 'Clear all' })).not.toBeInTheDocument();
	});

	it('moves focus to the heading when a removed chip takes it along', async () => {
		const { rerender } = await render(
			recipesPage({ ...recipesView(), holidays: ['easter', 'christmas'] })
		);
		page.getByRole('link', { name: 'Remove Easter' }).element().focus();

		await rerender(recipesPage({ ...recipesView(), holidays: ['christmas'] }));

		await expect.element(viewHeading()).toHaveFocus();
	});

	describe('found nothing', () => {
		it('offers Clear search and a search of All Recipes for a chapter’s search', async () => {
			await render(
				recipesPage({ ...recipesView('soups-salads'), text: 'biscuit', sort: 'relevance' }, nothing)
			);

			await expect
				.element(page.getByText('No recipes in Soups & Salads match “biscuit”.'))
				.toBeVisible();
			await expect
				.element(resultsRegion().getByRole('link', { name: 'Clear search' }))
				.toHaveAttribute('href', '/?chapter=soups-salads');
			await expect
				.element(resultsRegion().getByRole('link', { name: 'Search All Recipes for “biscuit”' }))
				.toHaveAttribute('href', '/?q=biscuit');
			await expect
				.element(resultsRegion().getByRole('link', { name: 'Clear filters' }))
				.not.toBeInTheDocument();
			await expect.element(countLine()).toHaveTextContent('No recipes matching “biscuit”');
			// For screen readers alone, beside the message that shows.
			await expect.element(countLine()).toHaveClass('sr-only');
		});

		it('offers Clear search and Clear filters for a search with filters', async () => {
			await render(
				recipesPage(
					{ ...recipesView(), text: 'biscuit', diets: ['vegan'], sort: 'relevance' },
					nothing
				)
			);

			await expect
				.element(page.getByText('No recipes match “biscuit” with these filters.'))
				.toBeVisible();
			await expect
				.element(resultsRegion().getByRole('link', { name: 'Clear search' }))
				.toHaveAttribute('href', '/?diet=vegan');
			await expect
				.element(resultsRegion().getByRole('link', { name: 'Clear filters' }))
				.toHaveAttribute('href', '/?q=biscuit');
			await expect
				.element(resultsRegion().getByRole('link', { name: /^Search All Recipes/ }))
				.not.toBeInTheDocument();
		});

		it('offers Clear filters for a chapter’s filters, keeping the chapter and the order', async () => {
			await render(
				recipesPage({ ...recipesView('desserts'), holidays: ['easter'], sort: 'newest' }, nothing)
			);

			await expect
				.element(page.getByText('No recipes in Desserts match these filters.'))
				.toBeVisible();
			await expect
				.element(resultsRegion().getByRole('link', { name: 'Clear filters' }))
				.toHaveAttribute('href', '/?chapter=desserts&sort=newest');
			await expect
				.element(resultsRegion().getByRole('link', { name: 'Clear search' }))
				.not.toBeInTheDocument();
		});

		it('says so alone for a chapter with no recipes', async () => {
			await render(recipesPage(recipesView('appetizers-beverages'), nothing));

			await expect
				.element(page.getByText('No recipes in Appetizers & Beverages yet.'))
				.toBeVisible();
			await expect
				.element(resultsRegion().getByRole('link', { name: /^Clear|^Search All Recipes/ }))
				.not.toBeInTheDocument();
		});

		it('shows no close matches notice for a close search the filters empty', async () => {
			await render(
				recipesPage(
					{ ...recipesView(), text: 'lemn', holidays: ['easter'], sort: 'relevance' },
					{ ...nothing, match: 'close' }
				)
			);

			await expect
				.element(page.getByText('No recipes match “lemn” with these filters.'))
				.toBeVisible();
			await expect.element(page.getByText(/Showing close matches/)).not.toBeInTheDocument();
		});
	});

	it.each([
		{ view: 'a chapter', state: recipesView('desserts'), backLabel: 'Back to Desserts' },
		{
			view: 'All Recipes, filtered',
			state: { ...recipesView(), diets: ['vegetarian' as const] },
			backLabel: 'Back to All Recipes',
		},
		{ view: 'a search', state: lemonDesserts, backLabel: 'Back to search results' },
	])('records $view as each recipe’s way back, by its name', async ({ state, backLabel }) => {
		holdPageLoads();
		history.replaceState(null, '', '/?chapter=desserts');
		// A followed link would load its page in place of the test's.
		await render(<div onClick={(event) => event.preventDefault()}>{recipesPage(state)}</div>);

		await page.getByRole('heading', { name: 'Lemon bars' }).click();

		expect(readRecipeOpenedFrom(readTabStorage('opened-from:/recipes/lemon-bars'))?.backLabel).toBe(
			backLabel
		);
	});
});
