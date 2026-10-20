import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import type { SavedDraftId } from '@/application/drafts/saved-draft';
import type { DraftSummaryDto } from '@/application/drafts/saved-draft-dtos';
import type { FormAction } from '@/components/forms/form-state';
import { DraftList } from '@/components/recipe-import/draft-list';

const savedId = '0199d2a0-1b2c-7d3e-8f40-000000000004' as SavedDraftId;
const fromLinkId = '0199d2a0-1b2c-7d3e-8f40-000000000005' as SavedDraftId;
const fromPhotosId = '0199d2a0-1b2c-7d3e-8f40-000000000003' as SavedDraftId;

const now = new Date('2026-10-15T18:00:00.000Z');

// A draft typed in this afternoon with no title, one read from a link, and one read from photos.
const drafts: DraftSummaryDto[] = [
	{
		id: savedId,
		savedAt: new Date('2026-10-15T15:00:00.000Z'),
		expiresAt: new Date('2027-01-13T15:00:00.000Z'),
	},
	{
		id: fromLinkId,
		mode: 'url',
		title: 'Lemon bars',
		savedAt: new Date('2026-10-14T18:00:00.000Z'),
		expiresAt: new Date('2027-01-12T18:00:00.000Z'),
	},
	{
		id: fromPhotosId,
		mode: 'photo',
		title: 'Anise cakes',
		savedAt: new Date('2026-10-13T18:00:00.000Z'),
		expiresAt: new Date('2027-01-11T18:00:00.000Z'),
	},
];

// Chooses Delete draft from the row's menu, which its button names by the draft and which holds
// only that, and returns the dialog that asks first.
async function deleteFromMenu(name: string) {
	await page.getByRole('button', { name: `Actions for ${name}` }).click();
	const menu = page.getByRole('menu');
	await expect.element(menu.getByRole('menuitem')).toHaveLength(1);
	await menu.getByRole('menuitem', { name: 'Delete draft' }).click();
	return page.getByRole('alertdialog');
}

describe('DraftList', () => {
	it('says so when there are none', async () => {
		await render(<DraftList drafts={[]} now={now} deleteDraft={vi.fn()} />);

		await expect.element(page.getByText('No drafts.')).toBeVisible();
		await expect.element(page.getByRole('list')).not.toBeInTheDocument();
	});

	it('lists each draft with its title, how it started, when it was saved, and when it goes, opening its page', async () => {
		await render(<DraftList drafts={drafts} now={now} deleteDraft={vi.fn()} />);

		// Each row's link is named by the draft's title and described by its details.
		const links = page.getByRole('listitem').getByRole('link');
		await expect.element(links).toHaveLength(3);
		await expect.element(links.nth(0)).toHaveAccessibleName('Untitled recipe');
		await expect
			.element(links.nth(0))
			.toHaveAccessibleDescription('Typed in Saved 3 hours ago Kept until January 13, 2027');
		await expect.element(links.nth(1)).toHaveAccessibleName('Lemon bars');
		await expect
			.element(links.nth(1))
			.toHaveAccessibleDescription('From a link Saved yesterday Kept until January 12, 2027');
		await expect.element(links.nth(2)).toHaveAccessibleName('Anise cakes');
		await expect
			.element(links.nth(2))
			.toHaveAccessibleDescription('From photos Saved 2 days ago Kept until January 11, 2027');
		expect(links.elements().map((link) => link.getAttribute('href'))).toEqual([
			`/contribute/drafts/${savedId}`,
			`/contribute/drafts/${fromLinkId}`,
			`/contribute/drafts/${fromPhotosId}`,
		]);
	});

	it('names its list a list, which Safari takes for a group without markers', async () => {
		await render(<DraftList drafts={drafts} now={now} deleteDraft={vi.fn()} />);

		await expect.element(page.getByRole('list')).toHaveAttribute('role', 'list');
	});

	it('deletes a draft from its row’s menu once asked, at the version the list shows', async () => {
		const deleteDraft = vi.fn<FormAction>(async () => ({ status: 'success' }));
		await render(<DraftList drafts={drafts} now={now} deleteDraft={deleteDraft} />);

		const dialog = await deleteFromMenu('Lemon bars');
		await expect.element(dialog).toHaveAccessibleName('Delete the draft of “Lemon bars”?');
		await dialog.getByRole('button', { name: 'Delete draft' }).click();

		await expect.poll(() => deleteDraft).toHaveBeenCalledOnce();
		expect(deleteDraft.mock.calls[0]?.[1].get('draftId')).toBe(fromLinkId);
		expect(deleteDraft.mock.calls[0]?.[1].get('draftVersion')).toBe('2026-10-14T18:00:00.000Z');
	});

	it('returns focus to the row’s menu button when the member keeps the draft', async () => {
		const deleteDraft = vi.fn<FormAction>();
		await render(<DraftList drafts={drafts} now={now} deleteDraft={deleteDraft} />);

		const dialog = await deleteFromMenu('Untitled recipe');
		await expect.element(dialog).toHaveAccessibleName('Delete this draft?');
		await dialog.getByRole('button', { name: 'Keep draft' }).click();

		await expect.element(dialog).not.toBeInTheDocument();
		await expect
			.element(page.getByRole('button', { name: 'Actions for Untitled recipe' }))
			.toHaveFocus();
		expect(deleteDraft).not.toHaveBeenCalled();
	});
});
