import type { Locator, Page } from '@playwright/test';
import { favoritesPath, recipeListPath } from '@/components/recipe/recipe-paths';
import { pressFavorite } from './support/favorite-toggle';
import { expect, test } from './support/fixtures';
import { expectHeaderSection } from './support/header-section';
import { waitForHydration } from './support/hydration';
import { sampleRecipe } from './support/sample-recipe';

// The back link reads the tab's history through the Navigation API, which Playwright 1.64's WebKit
// (27.2) and Chromium have with the entries Next pushes, so every project expects the link.

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

test('a recipe opened from Browse links back to the list as it was left', async ({
	page,
	isMobile,
}) => {
	await page.goto(recipeListPath);
	const lastCard = page.getByRole('main').getByRole('list').first().getByRole('link').last();
	await waitForHydration(lastCard);
	const scrollAtPress = await clickReadingScroll(page, lastCard);
	expect(scrollAtPress).toBeGreaterThan(0);

	const backLink = page.getByRole('link', { name: 'Back to recipes' });
	await expect(backLink).toBeVisible();
	await expectHeaderSection(page, isMobile, { section: 'Browse', ariaCurrent: 'true' });

	await backLink.click();
	await expect(page).toHaveURL(recipeListPath);
	await expect.poll(() => page.evaluate(() => Math.round(scrollY))).toBe(scrollAtPress);
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
