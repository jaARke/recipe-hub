import { expect, test } from './support/fixtures';
import { waitForHydration } from './support/hydration';
import { sampleRecipe } from './support/sample-recipe';

test.beforeEach(async ({ page }) => {
	await page.goto(sampleRecipe.path);
});

test('Start cooking opens the recipe’s cooking view', async ({ page }) => {
	await page
		.getByRole('group', { name: 'Recipe actions' })
		.getByRole('link', { name: 'Start cooking' })
		.click();

	await expect(page).toHaveURL(sampleRecipe.cookPath);
	await expect(
		page.getByRole('heading', { name: 'Gather your ingredients, step 0 of 7' })
	).toBeVisible();
});

test('More actions copies the recipe’s link', async ({ page, context, browserName }) => {
	// Only Chromium lets a test read the clipboard back.
	const readsClipboard = browserName === 'chromium';
	if (readsClipboard) {
		await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	}

	const moreActions = page.getByRole('button', { name: 'More actions' });
	await waitForHydration(moreActions);
	await moreActions.click();
	await page.getByRole('menuitem', { name: 'Copy link' }).click();

	await expect(page.getByRole('dialog', { name: 'Link copied' })).toBeVisible();
	if (readsClipboard) {
		expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
			new URL(sampleRecipe.path, page.url()).href
		);
	}
});

test('More actions offers Share only where the browser has a share sheet', async ({ page }) => {
	const hasShareSheet = await page.evaluate(() => typeof navigator.share === 'function');

	const moreActions = page.getByRole('button', { name: 'More actions' });
	await waitForHydration(moreActions);
	await moreActions.click();

	await expect(page.getByRole('menu').getByRole('menuitem')).toHaveText(
		hasShareSheet ? ['Share', 'Copy link', 'Print'] : ['Copy link', 'Print']
	);
});

test('Print prints the recipe with its link in place of the actions', async ({ page }) => {
	// The browser's print dialog would hold the page, so the test counts the calls instead.
	await page.addInitScript(() => {
		window.print = () => {
			const { dataset } = document.documentElement;
			dataset.printCalls = String(Number(dataset.printCalls ?? 0) + 1);
		};
	});
	await page.reload();

	const moreActions = page.getByRole('button', { name: 'More actions' });
	await waitForHydration(moreActions);
	await moreActions.click();
	await page.getByRole('menuitem', { name: 'Print' }).click();
	await expect(page.locator('html')).toHaveAttribute('data-print-calls', '1');

	await page.emulateMedia({ media: 'print' });
	await expect(page.getByRole('group', { name: 'Recipe actions' })).toBeHidden();
	await expect(page.getByText(new URL(sampleRecipe.path, page.url()).href)).toBeVisible();
});

test('the photo opens in the viewer, which closes again', async ({ page }) => {
	const viewPhoto = page.getByRole('button', { name: `View photo: ${sampleRecipe.photoAlt}` });
	await waitForHydration(viewPhoto);
	await viewPhoto.click();

	const viewer = page.getByRole('dialog');
	await expect(viewer.getByRole('img', { name: sampleRecipe.photoAlt })).toBeVisible();
	await viewer.getByRole('button', { name: 'Close' }).click();
	await expect(viewer).toBeHidden();
});
