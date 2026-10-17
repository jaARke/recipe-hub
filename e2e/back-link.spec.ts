import type { Locator, Page } from '@playwright/test';
import { favoritesPath, recipeListPath } from '@/components/recipe/recipe-paths';
import { pressFavorite } from './support/favorite-toggle';
import { expect, test } from './support/fixtures';
import { sampleRecipe } from './support/sample-recipe';

// The back link reads the tab's history through the Navigation API, which Playwright 1.64's WebKit
// (27.2) and Chromium have with the entries Next pushes, so every project expects the link.

const sections = ['Browse', 'Favorites', 'Add recipe'] as const;

// The header marks one section as current: in the main navigation, or on a phone in its menu.
async function expectHeaderSection(
	page: Page,
	isMobile: boolean,
	current: (typeof sections)[number]
) {
	if (isMobile) {
		await page.getByRole('button', { name: 'Menu' }).click();
	}
	const links = isMobile
		? page.getByRole('menu').getByRole('menuitem')
		: page.getByRole('navigation', { name: 'Main' }).getByRole('link');
	for (const section of sections) {
		const link = links.filter({ hasText: section });
		if (section === current) {
			await expect(link).toHaveAttribute('aria-current', 'true');
		} else {
			await expect(link).not.toHaveAttribute('aria-current');
		}
	}
	if (isMobile) {
		await page.keyboard.press('Escape');
		await expect(page.getByRole('menu')).toBeHidden();
	}
}

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
	const scrollAtPress = await clickReadingScroll(page, lastCard);
	expect(scrollAtPress).toBeGreaterThan(0);

	const backLink = page.getByRole('link', { name: 'Back to recipes' });
	await expect(backLink).toBeVisible();
	await expectHeaderSection(page, isMobile, 'Browse');

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
	await page.getByRole('main').getByRole('link', { name: sampleRecipe.title }).click();
	await expect(page).toHaveURL(sampleRecipe.path);
	const backLink = page.getByRole('link', { name: 'Back to Favorites' });
	await expect(backLink).toBeVisible();
	await expectHeaderSection(page, isMobile, 'Favorites');

	await backLink.click();
	await expect(page).toHaveURL(favoritesPath);
	await expect(page.getByRole('heading', { name: 'Favorites', level: 1 })).toBeVisible();
});
