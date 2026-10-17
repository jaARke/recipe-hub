import { expect, test } from './support/fixtures';
import { sampleRecipe } from './support/sample-recipe';

// The screen stays awake while the view shows, which only a device checks: headless Chromium and
// WebKit refuse a wake lock.

test('the cooking view walks the recipe a step at a time and picks up where the cook left off', async ({
	page,
}) => {
	await page.goto(sampleRecipe.cookPath);
	const main = page.getByRole('main');
	await expect(
		main.getByRole('heading', { name: 'Gather your ingredients, step 0 of 7' })
	).toBeVisible();
	await expect(main.getByText('0 of 8 gathered')).toBeVisible();

	await main.getByRole('checkbox', { name: '2½ cups all-purpose flour' }).check();
	await expect(main.getByText('1 of 8 gathered')).toBeVisible();

	await page.getByRole('button', { name: 'Start cooking' }).click();
	await expect(main.getByRole('heading', { name: 'Step 1 of 7' })).toBeVisible();
	await expect(
		main.getByText('Heat the oven to 450°F and line a baking sheet with parchment.')
	).toBeVisible();
	await page.getByRole('button', { name: 'Next step' }).click();
	await expect(main.getByRole('heading', { name: 'Step 2 of 7' })).toBeVisible();
	await page.getByRole('button', { name: 'Back' }).click();
	await expect(main.getByRole('heading', { name: 'Step 1 of 7' })).toBeVisible();
	await page.keyboard.press('ArrowRight');
	await expect(main.getByRole('heading', { name: 'Step 2 of 7' })).toBeVisible();
	await expect(page).toHaveURL(`${sampleRecipe.cookPath}?step=2`);

	// The screen is the URL's and the checks the tab's, so a reload keeps both.
	await page.reload();
	await expect(page.getByText('Picked up at step 2, where you left off.')).toBeVisible();
	await expect(main.getByRole('heading', { name: 'Step 2 of 7' })).toBeVisible();

	await page.getByRole('button', { name: 'Steps' }).click();
	const steps = page.getByRole('dialog', { name: 'Steps' });
	await steps.getByRole('button', { name: /^0\s*Gather your ingredients/ }).click();
	await expect(steps).toBeHidden();
	await expect(main.getByText('1 of 8 gathered')).toBeVisible();

	await page.getByRole('button', { name: 'Steps' }).click();
	await steps.getByRole('button', { name: /^7\s*Beat the butter and honey/ }).click();
	await expect(main.getByRole('heading', { name: 'Step 7 of 7' })).toBeVisible();
	await page.getByRole('button', { name: 'Finish' }).click();
	await expect(
		main.getByRole('heading', { name: `Enjoy your ${sampleRecipe.title}` })
	).toBeVisible();

	await page.getByRole('link', { name: 'Back to the recipe' }).click();
	await expect(page).toHaveURL(sampleRecipe.path);
});

test('scaling the recipe scales its ingredients and keeps the scale in the URL', async ({
	page,
}) => {
	await page.goto(sampleRecipe.cookPath);
	const main = page.getByRole('main');
	const biscuits = main.getByRole('textbox', { name: 'Biscuits' });
	await expect(biscuits).toHaveValue('10');

	// Ten biscuits step by five, half the recipe.
	await main.getByRole('button', { name: 'Increase' }).click();
	await expect(biscuits).toHaveValue('15');
	await expect(page).toHaveURL(`${sampleRecipe.cookPath}?makes=15`);
	await expect(main.getByRole('checkbox', { name: '3¾ cups all-purpose flour' })).toBeVisible();
	await expect(main.getByRole('checkbox', { name: '1½ cups cold buttermilk' })).toBeVisible();

	await main.getByRole('button', { name: 'Reset' }).click();
	await expect(biscuits).toHaveValue('10');
	await expect(page).toHaveURL(sampleRecipe.cookPath);
	await expect(main.getByRole('checkbox', { name: '2½ cups all-purpose flour' })).toBeVisible();

	await biscuits.fill('20');
	await biscuits.blur();
	await expect(page).toHaveURL(`${sampleRecipe.cookPath}?makes=20`);
	await expect(main.getByRole('checkbox', { name: '5 cups all-purpose flour' })).toBeVisible();
	await expect(main.getByRole('checkbox', { name: '2 cups cold buttermilk' })).toBeVisible();

	// A step naming only an oven's temperature has no amount to keep, so it says nothing of the scale.
	await page.getByRole('button', { name: 'Start cooking' }).click();
	await expect(main.getByRole('heading', { name: 'Step 1 of 7' })).toBeVisible();
	await expect(main.getByText(/^Amounts in the steps are for/)).toBeHidden();

	await page.reload();
	await page.getByRole('button', { name: 'Steps' }).click();
	await page
		.getByRole('dialog', { name: 'Steps' })
		.getByRole('button', { name: /^0\s*Gather your ingredients/ })
		.click();
	await expect(biscuits).toHaveValue('20');
});
