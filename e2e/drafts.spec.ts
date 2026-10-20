import type { Page } from '@playwright/test';
import { recipeEntryPaths } from '@/components/recipe-import/recipe-entry-paths';
import { contributePath } from '@/components/recipe/recipe-paths';
import { expect, test } from './support/fixtures';
import { expectAddRecipeLink } from './support/header-section';
import { waitForHydration } from './support/hydration';
import {
	draftStatus,
	listedDraft,
	openTypeItIn,
	savedDraftAddress,
	yourDrafts,
} from './support/recipe-drafts';

// A member's drafts save themselves as they type, and the start page lists them as they now are.
// Each test's drafts are its own member's, which the member fixture deletes with it.

// The start page's notice naming the draft just left.
function keptNotice(page: Page) {
	return page.getByRole('status').filter({ hasText: 'is kept in your drafts' });
}

function backToStart(page: Page) {
	return page.getByRole('link', { name: 'Back to Add a Recipe' });
}

// Starts a draft from the start page's Type it in by typing its title, and waits for its first
// save, which names the draft in the address and heads the page with its title. Saving waits a
// second after the last change, so the status says so for at least that long.
async function typeNewDraft(page: Page, title: string) {
	await page.goto(contributePath);
	await openTypeItIn(page);
	await page.getByRole('textbox', { name: 'Title' }).fill(title);
	await expect(draftStatus(page, 'Saving draft')).toBeVisible();
	await expect(draftStatus(page, 'Draft saved')).toBeVisible();
	await expect(page).toHaveURL(savedDraftAddress);
	await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible();
}

// Opens a draft by its row in the start page's list, as a member resumes one.
async function openListedDraft(page: Page, name: string) {
	const row = listedDraft(page, name);
	await waitForHydration(row);
	await row.click();
	await expect(page).toHaveURL(savedDraftAddress);
	await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();
}

// The status says the change is saving, until the heading names the draft's title as saved.
async function renameDraft(page: Page, title: string) {
	await page.getByRole('textbox', { name: 'Title' }).fill(title);
	await expect(draftStatus(page, 'Saving draft')).toBeVisible();
	await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible();
	await expect(draftStatus(page, 'Draft saved')).toBeVisible();
}

// Deletes the draft through the ⋯ menu named, confirming in the dialog, then closes the toast that
// says so with Escape, as from the keyboard, since it would otherwise outlast a change of page and
// stand beside the next deletion's. Its close button is hidden from the accessibility tree until the
// toasts expand.
async function deleteDraftThroughMenu(page: Page, menuName: string, title: string) {
	const menu = page.getByRole('button', { name: menuName });
	await waitForHydration(menu);
	await menu.click();
	await page.getByRole('menuitem', { name: 'Delete draft' }).click();
	await page
		.getByRole('alertdialog', { name: `Delete the draft of “${title}”?` })
		.getByRole('button', { name: 'Delete draft' })
		.click();
	const deleted = page.getByRole('dialog', { name: 'Draft deleted' });
	await expect(deleted).toBeVisible();
	await deleted.press('Escape');
	await expect(deleted).toBeHidden();
}

test('typing saves a draft, which the header counts and Finish later keeps', async ({
	page,
	isMobile,
	signIn,
}) => {
	const title = 'Anise cakes';
	await signIn();
	await typeNewDraft(page, title);
	const draftUrl = page.url();
	await expectAddRecipeLink(page, isMobile, 'Add recipe, 1 draft');

	await page.getByRole('button', { name: 'Finish later' }).click();
	await expect(page).toHaveURL(contributePath);
	await expect(keptNotice(page)).toHaveText(
		`“${title}” is kept in your drafts, on any device. Open it`
	);
	await expect(listedDraft(page, title)).toHaveAccessibleDescription(
		/^Typed in Saved just now Kept until [A-Z][a-z]+ \d{1,2}, \d{4}$/
	);

	// Open it reopens the draft as it was saved.
	const openIt = keptNotice(page).getByRole('link', { name: 'Open it' });
	await waitForHydration(openIt);
	await openIt.click();
	await expect(page).toHaveURL(draftUrl);
	await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible();
	await expect(page.getByRole('textbox', { name: 'Title' })).toHaveValue(title);
	await expect(draftStatus(page, 'Draft saved')).toBeVisible();
});

test('a renamed draft shows its new title in the list, left by its back link or by browser Back', async ({
	page,
	signIn,
}) => {
	await signIn();
	await typeNewDraft(page, 'Anise cakes');
	await page.getByRole('button', { name: 'Finish later' }).click();
	await openListedDraft(page, 'Anise cakes');

	// The back link says the draft is kept, by the title it now has.
	await renameDraft(page, 'Mom’s anise cakes');
	await backToStart(page).click();
	await expect(page).toHaveURL(contributePath);
	await expect(keptNotice(page)).toHaveText(
		'“Mom’s anise cakes” is kept in your drafts, on any device. Open it'
	);
	await expect(listedDraft(page, 'Mom’s anise cakes')).toBeVisible();
	await expect(listedDraft(page, 'Anise cakes')).toBeHidden();

	// Browser Back shows the start page as it was left, without the notice of that visit, then reads
	// the list again, so it shows the draft as it now is. The notice is checked first, while the page
	// may still show as it was left.
	await openListedDraft(page, 'Mom’s anise cakes');
	await renameDraft(page, 'Grandma’s anise cakes');
	await page.goBack();
	await expect(page).toHaveURL(contributePath);
	await expect(yourDrafts(page)).toBeVisible();
	await expect(keptNotice(page)).toBeHidden();
	await expect(listedDraft(page, 'Grandma’s anise cakes')).toBeVisible();
	await expect(listedDraft(page, 'Mom’s anise cakes')).toBeHidden();
});

test('a draft deleted from the list or from its page leaves the list and the header’s count', async ({
	page,
	isMobile,
	signIn,
}) => {
	await signIn();
	await typeNewDraft(page, 'Anise cakes');
	await typeNewDraft(page, 'Lemon bars');
	await expectAddRecipeLink(page, isMobile, 'Add recipe, 2 drafts');

	await page.goto(contributePath);
	await deleteDraftThroughMenu(page, 'Actions for Anise cakes', 'Anise cakes');
	await expect(listedDraft(page, 'Anise cakes')).toBeHidden();
	await expect(listedDraft(page, 'Lemon bars')).toBeVisible();
	await expectAddRecipeLink(page, isMobile, 'Add recipe, 1 draft');

	// Deleting the draft open on its page leaves for the start page.
	await openListedDraft(page, 'Lemon bars');
	await deleteDraftThroughMenu(page, 'Draft actions', 'Lemon bars');
	await expect(page).toHaveURL(contributePath);
	await expect(yourDrafts(page)).toContainText('No drafts.');
	await expectAddRecipeLink(page, isMobile, 'Add recipe');
});

test('emptying a draft deletes it', async ({ page, isMobile, signIn }) => {
	await signIn();
	await typeNewDraft(page, 'Anise cakes');
	await page.getByRole('button', { name: 'Finish later' }).click();
	await openListedDraft(page, 'Anise cakes');

	// Once the draft is deleted, the address is the new recipe's again, and the page is untitled.
	await page.getByRole('textbox', { name: 'Title' }).clear();
	await expect(page).toHaveURL(recipeEntryPaths.manual);
	await expect(page.getByRole('heading', { name: 'Untitled recipe', level: 1 })).toBeVisible();
	await expect(draftStatus(page, 'Draft saved')).toBeHidden();

	// With nothing kept, the back link says nothing, and the list and the header's count lose it.
	await backToStart(page).click();
	await expect(page).toHaveURL(contributePath);
	await expect(yourDrafts(page)).toContainText('No drafts.');
	await expect(keptNotice(page)).toBeHidden();
	await expectAddRecipeLink(page, isMobile, 'Add recipe');
});

test('Type it in opens an empty form, whatever was typed on an earlier visit', async ({
	page,
	signIn,
}) => {
	await signIn();
	await typeNewDraft(page, 'Anise cakes');
	await backToStart(page).click();
	await expect(keptNotice(page)).toHaveText(
		'“Anise cakes” is kept in your drafts, on any device. Open it'
	);

	// The form opens empty again, untitled and saving nothing yet.
	await openTypeItIn(page);
});
