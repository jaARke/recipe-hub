import { expect, type Locator, type Page } from '@playwright/test';
import { waitForHydration } from './hydration';

// The Recipes page's results under their hidden heading: the chips, the count line, the recipes, and
// the pages.
export function recipesResults(page: Page): Locator {
	return page.getByRole('region', { name: 'Recipes', exact: true });
}

// Below lg the page's heading, which names the view, opens the chapters in a bottom sheet, whose rows
// show once the view's counts are read.
export async function openChapterPicker(page: Page): Promise<Locator> {
	const picker = page.getByRole('heading', { level: 1 }).getByRole('button');
	await waitForHydration(picker);
	await picker.click();
	const sheet = page.getByRole('dialog', { name: 'Chapters' });
	await expect(sheet.getByRole('link').first()).toBeVisible();
	return sheet;
}

// Below lg Filter and sort's button, named with the count of filters applied, opens it in a bottom
// sheet.
export async function openFilterSheet(page: Page): Promise<Locator> {
	const trigger = page.getByRole('button', { name: /^Filter and sort/ });
	await waitForHydration(trigger);
	await trigger.click();
	const sheet = page.getByRole('dialog', { name: 'Filter and sort' });
	await expect(sheet).toBeVisible();
	return sheet;
}
