import { randomUUID } from 'node:crypto';
import type { Locator, Page } from '@playwright/test';
import { favoritesPath, recipeListPath, recipePath } from '@/components/recipe/recipe-paths';
import { slugify } from '@/domain/recipe/slug';
import { pressFavorite } from './support/favorite-toggle';
import { expect, test as base } from './support/fixtures';
import { expectHeaderSection } from './support/header-section';
import { waitForHydration } from './support/hydration';
import { withOwnRecipes, type OwnRecipe } from './support/own-recipes';
import { recipesResults } from './support/recipes-page';
import { sampleRecipe } from './support/sample-recipe';

// The back link reads the tab's history through the Navigation API, which Playwright 1.64's WebKit
// (27.2) and Chromium have with the entries Next pushes, so every project expects the link.

const test = base.extend<{ lemonBars: OwnRecipe }>({
	// The member's own, in Cookies & Candy, which a view filtered by the member's id lists alone.
	lemonBars: async ({ page, signIn }, use) => {
		await signIn();
		const lemonBars = {
			title: `End-to-end lemon bars ${randomUUID().slice(0, 8)}`,
			ingredient: '3 lemons',
			step: 'Bake until set.',
			chapter: 'Cookies & Candy',
			holidays: [],
			diets: [],
		};
		await withOwnRecipes(page, { lemonBars }, () => use(lemonBars));
	},
});

// A recipe opened from the Recipes page's view is in its section.
const recipesSection = { section: 'Recipes', ariaCurrent: 'true' } as const;

// Clicks the target and returns the page's scroll as the press started, since Playwright's click
// scrolls its target into view first. The page stays the same document through Next's navigation.
async function clickReadingScroll(page: Page, target: Locator): Promise<number> {
	await page.evaluate(() => {
		addEventListener(
			'pointerdown',
			() => {
				document.documentElement.dataset.scrollAtPress = String(Math.round(scrollY));
			},
			{ capture: true, once: true }
		);
	});
	await target.click();
	return Number(await page.locator('html').getAttribute('data-scroll-at-press'));
}

// Opens the recipe from the view's list, which records the view as where it was opened from.
async function openListedRecipe(page: Page, recipe: OwnRecipe) {
	const item = recipesResults(page).getByRole('link', { name: recipe.title });
	await waitForHydration(item);
	await item.click();
	await expect(page).toHaveURL(recipePath(slugify(recipe.title)));
}

test('a recipe opened from All Recipes links back to the list as it was left', async ({
	page,
	isMobile,
}) => {
	await page.goto(recipeListPath);
	const lastItem = recipesResults(page).getByRole('list').first().getByRole('link').last();
	await waitForHydration(lastItem);
	const scrollAtPress = await clickReadingScroll(page, lastItem);
	expect(scrollAtPress).toBeGreaterThan(0);

	const backLink = page.getByRole('link', { name: 'Back to All Recipes' });
	await expect(backLink).toBeVisible();
	await expectHeaderSection(page, isMobile, recipesSection);

	await backLink.click();
	await expect(page).toHaveURL(recipeListPath);
	await expect.poll(() => page.evaluate(() => Math.round(scrollY))).toBe(scrollAtPress);
});

test('a recipe opened from a chapter or a search names the view in its back link, which returns to it', async ({
	page,
	isMobile,
	member,
	lemonBars,
}) => {
	const byMember = `contributor=${member.id}`;
	const chapter = `${recipeListPath}?chapter=cookies-candy&${byMember}`;
	await page.goto(chapter);
	await openListedRecipe(page, lemonBars);
	const backToChapter = page.getByRole('link', { name: 'Back to Cookies & Candy' });
	await expect(backToChapter).toBeVisible();
	await expectHeaderSection(page, isMobile, recipesSection);
	await backToChapter.click();
	await expect(page).toHaveURL(chapter);
	await expect(page.getByRole('heading', { name: 'Cookies & Candy', level: 1 })).toBeVisible();

	const search = `${recipeListPath}?q=lemon&${byMember}`;
	await page.goto(search);
	await openListedRecipe(page, lemonBars);
	const backToSearch = page.getByRole('link', { name: 'Back to search results' });
	await expect(backToSearch).toBeVisible();
	await expectHeaderSection(page, isMobile, recipesSection);
	await backToSearch.click();
	await expect(page).toHaveURL(search);
	await expect(
		page.getByRole('searchbox', { name: 'Search All Recipes', exact: true })
	).toHaveValue('lemon');
});

test('a recipe opened from Favorites links back to Favorites, which the header marks', async ({
	page,
	isMobile,
}) => {
	await page.goto(sampleRecipe.path);
	await expect(page.getByRole('link', { name: /^Back to/ })).toBeHidden();
	await pressFavorite(page, true);

	await page.goto(favoritesPath);
	const card = page.getByRole('main').getByRole('link', { name: sampleRecipe.title });
	await waitForHydration(card);
	await card.click();
	await expect(page).toHaveURL(sampleRecipe.path);
	const backLink = page.getByRole('link', { name: 'Back to Favorites' });
	await expect(backLink).toBeVisible();
	await expectHeaderSection(page, isMobile, { section: 'Favorites', ariaCurrent: 'true' });

	await backLink.click();
	await expect(page).toHaveURL(favoritesPath);
	await expect(page.getByRole('heading', { name: 'Favorites', level: 1 })).toBeVisible();
});
