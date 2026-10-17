import type { Page } from '@playwright/test';
import { favoritesPath } from '@/components/recipe/recipe-paths';
import { pressFavorite } from './support/favorite-toggle';
import { expect, test } from './support/fixtures';
import { sampleRecipe } from './support/sample-recipe';

const deviceNote = 'Your favorites are kept in a cookie on this device until you sign in.';

function favoriteCard(page: Page) {
	return page.getByRole('main').getByRole('link', { name: sampleRecipe.title });
}

test('signed out, a favorite is kept on the device until it is removed', async ({ page }) => {
	await page.goto(sampleRecipe.path);
	await pressFavorite(page, true);

	await page.goto(favoritesPath);
	await expect(page.getByText(deviceNote)).toBeVisible();
	await expect(favoriteCard(page)).toBeVisible();

	await favoriteCard(page).click();
	await pressFavorite(page, false);
	await page.goto(favoritesPath);
	await expect(page.getByText('No favorites yet')).toBeVisible();
});

test('signed in, a favorite is kept in the account until it is removed', async ({
	page,
	context,
	signIn,
}) => {
	await signIn();
	await page.goto(sampleRecipe.path);
	await pressFavorite(page, true);

	// Another session of the member, with nothing kept on the device, lists it too.
	await context.clearCookies();
	await signIn();
	await page.goto(favoritesPath);
	await expect(favoriteCard(page)).toBeVisible();
	await expect(page.getByText(deviceNote)).toBeHidden();

	await favoriteCard(page).click();
	await pressFavorite(page, false);
	await page.goto(favoritesPath);
	await expect(page.getByText('No favorites yet')).toBeVisible();
});

test('signing in moves the device’s favorites into the account', async ({ page, signIn }) => {
	await page.goto(sampleRecipe.path);
	await pressFavorite(page, true);

	// Signing in loads a new page, where the merge runs.
	await signIn();
	await page.goto(favoritesPath);
	await expect(
		page.getByRole('dialog', { name: '1 favorite added to your account' })
	).toBeVisible();
	await expect(favoriteCard(page)).toBeVisible();
	await expect(page.getByText(deviceNote)).toBeHidden();
});
