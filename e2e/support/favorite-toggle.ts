import { expect, type Page } from '@playwright/test';

// Presses Favorite on the recipe page shown and waits for its Server Action's response, which starts
// once the change is saved. A signed-in page load where the device keeps favorites first posts them
// to the account (DeviceFavoritesMerge), so the press waits for the page to settle, leaving its post
// the only one.
export async function pressFavorite(page: Page, pressed: boolean) {
	const toggle = page.getByRole('button', { name: 'Favorite' });
	await expect(toggle).toHaveAttribute('aria-pressed', String(!pressed));
	await page.waitForLoadState('networkidle');
	const recipePath = new URL(page.url()).pathname;
	const saved = page.waitForResponse(
		(response) =>
			response.request().method() === 'POST' && new URL(response.url()).pathname === recipePath
	);
	await toggle.click();
	await saved;
	await expect(toggle).toHaveAttribute('aria-pressed', String(pressed));
}
