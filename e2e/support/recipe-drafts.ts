import { expect, type Locator, type Page } from '@playwright/test';
import { recipeEntryPaths, savedDraftPath } from '@/components/recipe-import/recipe-entry-paths';
import { waitForHydration } from './hydration';

// Any draft's own address, which the form's first save puts in place of the new recipe's.
export const savedDraftAddress = new RegExp(`${savedDraftPath('[\\da-f-]{36}')}$`);

// What the recipe form's action bar says of its draft, such as "Draft saved".
export function draftStatus(page: Page, message: string): Locator {
	return page.getByRole('status').filter({ hasText: message });
}

// The start page's list of the member's drafts.
export function yourDrafts(page: Page): Locator {
	return page.getByRole('region', { name: 'Your drafts' });
}

// A draft's row in the list, a link named by its title.
export function listedDraft(page: Page, name: string): Locator {
	return yourDrafts(page).getByRole('link', { name, exact: true });
}

// Opens the start page's Type it in, as a member does, onto an empty form for a new recipe.
export async function openTypeItIn(page: Page) {
	const typeItIn = page.getByRole('link', { name: 'Type it in' });
	await waitForHydration(typeItIn);
	await typeItIn.click();
	await expect(page).toHaveURL(recipeEntryPaths.manual);
	await expect(page.getByRole('heading', { name: 'Untitled recipe', level: 1 })).toBeVisible();
	await expect(page.getByRole('textbox', { name: 'Title' })).toHaveValue('');
	// Add to cookbook is disabled until the form hydrates, before which its buttons do nothing and
	// nothing typed is saved.
	await expect(page.getByRole('button', { name: 'Add to cookbook' })).toBeEnabled();
}
