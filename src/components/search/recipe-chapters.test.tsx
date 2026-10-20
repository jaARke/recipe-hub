import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { page, userEvent } from 'vitest/browser';
import type { RecipeSearchFacets } from '@/application/ports/recipe-search';
import { noRecipeSearchFacets } from '@/application/testing/fixed-recipe-search';
import { holdPageLoads } from '@/components/auth/testing/page-loads';
import { recipeChapterRows } from '@/components/search/recipe-chapter-rows';
import {
	RecipeChapterPicker,
	RecipeChaptersNav,
	type RecipeChapterRow,
} from '@/components/search/recipe-chapters';
import {
	recipesView,
	recipesViewName,
	type RecipeSearchState,
} from '@/components/search/search-params';

// Next's bfcacheId for the page's segment, which a change of chapter keeps, as any new query does.
const router = vi.hoisted(() => ({ bfcacheId: 'first-visit' }));

vi.mock('next/navigation', async (importOriginal) => ({
	...(await importOriginal<typeof import('next/navigation')>()),
	useRouter: () => router,
}));

// Tailwind's lg breakpoint, from which the sidebar holds the list and the heading is plain text.
const lgViewport = { width: 1024, height: 768 };

// Five recipes within the words and filters: three desserts, a cookie, and a bread.
const facets: Pick<RecipeSearchFacets, 'allRecipes' | 'chapters'> = {
	allRecipes: 5,
	chapters: {
		...noRecipeSearchFacets.chapters,
		'breads-rolls': 1,
		desserts: 3,
		'cookies-candy': 1,
	},
};

// Desserts searched for lemon among Christmas recipes, on its second page.
const lemonDesserts: RecipeSearchState = {
	text: 'lemon',
	chapter: 'desserts',
	holidays: ['christmas'],
	diets: [],
	sort: 'relevance',
	page: 2,
};

// Each row's name, in the cookbook's order, with its count as the sidebar shows it.
const sidebarRows = [
	'All Recipes 5',
	'Breakfast & Brunch 0',
	'Appetizers & Beverages 0',
	'Soups & Salads 0',
	'Vegetables & Side Dishes 0',
	'Main Dishes 0',
	'Breads & Rolls 1',
	'Desserts 3',
	'Cookies & Candy 1',
	'This & That 0',
];

// Every row's query, wherever its view lives: the words and the filters, its chapter, and no page.
const lemonQueries = [
	'?q=lemon&holiday=christmas',
	'?q=lemon&chapter=breakfast-brunch&holiday=christmas',
	'?q=lemon&chapter=appetizers-beverages&holiday=christmas',
	'?q=lemon&chapter=soups-salads&holiday=christmas',
	'?q=lemon&chapter=vegetables-sides&holiday=christmas',
	'?q=lemon&chapter=main-dishes&holiday=christmas',
	'?q=lemon&chapter=breads-rolls&holiday=christmas',
	'?q=lemon&chapter=desserts&holiday=christmas',
	'?q=lemon&chapter=cookies-candy&holiday=christmas',
	'?q=lemon&chapter=this-and-that&holiday=christmas',
];

function sidebar(state: RecipeSearchState) {
	return <RecipeChaptersNav rows={recipeChapterRows(state, facets)} />;
}

function sidebarLinks() {
	return page.getByRole('navigation', { name: 'Chapters' }).getByRole('link');
}

// As the page composes it, the heading naming the view the state shows, its counts already read.
function picker(state: RecipeSearchState) {
	return (
		<RecipeChapterPicker
			id="recipes-heading"
			heading={recipesViewName(state).heading}
			rows={Promise.resolve(recipeChapterRows(state, facets))}
		/>
	);
}

function chapters() {
	return page.getByRole('dialog', { name: 'Chapters' });
}

describe('RecipeChaptersNav', () => {
	it('lists All Recipes and the chapters with their counts, marking the current one', async () => {
		await render(sidebar(lemonDesserts));
		const links = sidebarLinks();

		expect(links.elements()).toHaveLength(sidebarRows.length);
		for (const [index, name] of sidebarRows.entries()) {
			await expect.element(links.nth(index)).toHaveAccessibleName(name);
		}
		await expect.element(links.nth(7)).toHaveAttribute('aria-current', 'page');
		expect(links.elements().filter((link) => link.hasAttribute('aria-current'))).toEqual([
			links.nth(7).element(),
		]);
	});

	it('keeps the words and the filters in every row, empty or not, from the first page', async () => {
		await render(sidebar(lemonDesserts));

		expect(
			sidebarLinks()
				.elements()
				.map((link) => (link as HTMLAnchorElement).search)
		).toEqual(lemonQueries);
	});

	it('leaves an order out of the URL where it is the view’s own', async () => {
		// All Recipes A to Z, which is each chapter's own order.
		await render(sidebar({ ...recipesView(), holidays: ['christmas'], sort: 'title' }));

		await expect
			.element(sidebarLinks().filter({ hasText: 'All Recipes' }))
			.toHaveAttribute('href', '/?holiday=christmas&sort=title');
		await expect
			.element(sidebarLinks().filter({ hasText: 'Desserts' }))
			.toHaveAttribute('href', '/?chapter=desserts&holiday=christmas');
	});
});

describe('RecipeChapterPicker', () => {
	it('reads as the view’s name, its button saying it chooses a chapter', async () => {
		await render(picker(lemonDesserts));
		const heading = page.getByRole('heading', { level: 1 });
		const button = heading.getByRole('button');

		await expect.element(heading).toHaveAccessibleName('Desserts');
		await expect.element(button).toHaveAccessibleName('Desserts');
		await expect.element(button).toHaveAccessibleDescription('Choose a chapter');
		await expect.element(button).toHaveAttribute('aria-haspopup', 'dialog');
	});

	it('is plain text from lg, where the sidebar holds the list', async () => {
		await page.viewport(lgViewport.width, lgViewport.height);
		await render(picker(lemonDesserts));

		await expect.element(page.getByRole('heading', { level: 1 })).toHaveAccessibleName('Desserts');
		await expect.element(page.getByRole('button')).not.toBeInTheDocument();
	});

	it('opens the chapters in a sheet, each with its count, the current one checked', async () => {
		await render(picker(lemonDesserts));

		await page.getByRole('button', { name: 'Desserts' }).click();

		const links = chapters().getByRole('link');
		await expect.element(chapters()).toBeVisible();
		await expect.element(links.nth(0)).toHaveAccessibleName('All Recipes 5 recipes');
		await expect.element(links.nth(1)).toHaveAccessibleName('Breakfast & Brunch 0 recipes');
		await expect.element(links.nth(7)).toHaveAccessibleName('Desserts 3 recipes');
		await expect.element(links.nth(8)).toHaveAccessibleName('Cookies & Candy 1 recipe');
		await expect.element(links.nth(7)).toHaveAttribute('aria-current', 'page');
		expect(links.elements().map((link) => (link as HTMLAnchorElement).search)).toEqual(
			lemonQueries
		);
		const checkedRows = links.elements().filter((link) => {
			const check = link.querySelector('svg');
			return check !== null && getComputedStyle(check).visibility === 'visible';
		});
		expect(checkedRows).toEqual([links.nth(7).element()]);
	});

	it('names the view before its counts are read, which the open sheet waits for', async () => {
		const rows = Promise.withResolvers<readonly RecipeChapterRow[]>();
		await render(
			<RecipeChapterPicker id="recipes-heading" heading="Desserts" rows={rows.promise} />
		);

		await page.getByRole('button', { name: 'Desserts' }).click();

		await expect.element(chapters().getByRole('status')).toHaveTextContent('Loading chapters');
		rows.resolve(recipeChapterRows(lemonDesserts, facets));
		await expect
			.element(chapters().getByRole('link', { name: 'Desserts 3 recipes' }))
			.toHaveAttribute('aria-current', 'page');
		await expect.element(chapters().getByRole('status')).not.toBeInTheDocument();
	});

	it('closes as a row leads to its view, whose heading takes focus', async () => {
		const loads = holdPageLoads();
		const { rerender } = await render(picker(recipesView()));
		await page.getByRole('button', { name: 'All Recipes' }).click();

		await chapters().getByRole('link', { name: 'Desserts 3 recipes' }).click();
		// The view the row leads to, which a navigation would render.
		await rerender(picker(recipesView('desserts')));

		await expect.element(chapters()).not.toBeInTheDocument();
		await expect.element(page.getByRole('heading', { name: 'Desserts' })).toHaveFocus();
		await expect.poll(() => loads).toEqual([{ path: '/?chapter=desserts', type: 'push' }]);
	});

	it('closes as Back or Forward shows another view, giving focus back to its button', async () => {
		const desserts = recipesView('desserts');
		const { rerender } = await render(picker(desserts));
		await page.getByRole('button', { name: 'Desserts' }).click();
		await expect.element(chapters()).toBeVisible();

		// The view history moves to, which Next renders on the page it keeps.
		await rerender(picker({ ...desserts, holidays: ['christmas'] }));

		await expect.element(chapters()).not.toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Desserts' })).toHaveFocus();
	});

	it('gives focus back to its button when closed without a choice', async () => {
		await render(picker(recipesView()));
		await page.getByRole('button', { name: 'All Recipes' }).click();
		await expect.element(chapters()).toBeVisible();

		await userEvent.keyboard('{Escape}');

		await expect.element(chapters()).not.toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'All Recipes' })).toHaveFocus();
	});
});
