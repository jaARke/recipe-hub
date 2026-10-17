import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import type { SavedDraftId } from '@/application/drafts/saved-draft';
import type { DraftSummaryDto } from '@/application/drafts/saved-draft-dtos';
import type { FormAction } from '@/components/forms/form-state';
import { DraftList } from '@/components/recipe-import/draft-list';
import type { RecipeImportId } from '@/domain/recipe/recipe-import';

const router = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock('next/navigation', async (importOriginal) => ({
	...(await importOriginal<typeof import('next/navigation')>()),
	useRouter: () => router,
}));

const memberId = '3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b';
const savedId = '0199d2a0-1b2c-7d3e-8f40-000000000004' as SavedDraftId;
const continuingId = '0199d2a0-1b2c-7d3e-8f40-000000000005' as SavedDraftId;
const continuedImportId = '0199d2a0-1b2c-7d3e-8f40-000000000006' as RecipeImportId;
const importId = '0199d2a0-1b2c-7d3e-8f40-000000000003' as RecipeImportId;

const now = new Date('2026-10-15T18:00:00.000Z');

// A draft saved this morning with no title, one continuing an import from a link, and an import
// from a link.
const drafts: DraftSummaryDto[] = [
	{
		kind: 'saved',
		id: savedId,
		savedAt: new Date('2026-10-15T15:00:00.000Z'),
		expiresAt: new Date('2026-11-14T15:00:00.000Z'),
	},
	{
		kind: 'saved',
		id: continuingId,
		continuesImportId: continuedImportId,
		mode: 'url',
		title: 'Lemon bars',
		savedAt: new Date('2026-10-14T18:00:00.000Z'),
		expiresAt: new Date('2026-11-13T18:00:00.000Z'),
	},
	{
		kind: 'import',
		id: importId,
		mode: 'url',
		title: 'Sheet-pan gnocchi',
		importedAt: new Date('2026-10-13T18:00:00.000Z'),
		expiresAt: new Date('2026-10-20T18:00:00.000Z'),
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

afterEach(() => {
	localStorage.clear();
});

describe('DraftList', () => {
	it('says how long drafts stay when there are none', async () => {
		await render(<DraftList drafts={[]} now={now} memberId={memberId} deleteDraft={vi.fn()} />);

		await expect.element(page.getByText('No drafts')).toBeVisible();
		await expect
			.element(
				page.getByText(
					'A draft you save stays here for 30 days after your last save, and an import you haven’t saved for 7 days.'
				)
			)
			.toBeVisible();
	});

	it('lists each draft with its title, when it was saved, and when it goes, opening where it continues', async () => {
		await render(<DraftList drafts={drafts} now={now} memberId={memberId} deleteDraft={vi.fn()} />);

		// Each row's link is named by the draft's title and described by its details.
		const links = page.getByRole('listitem').getByRole('link');
		await expect.element(links).toHaveLength(3);
		await expect.element(links.nth(0)).toHaveAccessibleName('Untitled recipe');
		await expect
			.element(links.nth(0))
			.toHaveAccessibleDescription('Saved draft Saved 3 hours ago Kept until November 14, 2026');
		await expect.element(links.nth(1)).toHaveAccessibleName('Lemon bars');
		await expect
			.element(links.nth(1))
			.toHaveAccessibleDescription('From a link Saved yesterday Kept until November 13, 2026');
		await expect.element(links.nth(2)).toHaveAccessibleName('Sheet-pan gnocchi');
		await expect
			.element(links.nth(2))
			.toHaveAccessibleDescription('From a link Imported 2 days ago Kept until October 20, 2026');
		expect(links.elements().map((link) => link.getAttribute('href'))).toEqual([
			`/contribute?draft=${savedId}`,
			`/contribute/imports/${continuedImportId}`,
			`/contribute/imports/${importId}`,
		]);
	});

	it('says where a draft saved from an import came from once it opens on its own', async () => {
		await render(
			<DraftList
				drafts={[
					{
						kind: 'saved',
						id: savedId,
						mode: 'photo',
						title: 'Anise cakes',
						savedAt: new Date('2026-10-15T15:00:00.000Z'),
						expiresAt: new Date('2026-11-14T15:00:00.000Z'),
					},
				]}
				now={now}
				memberId={memberId}
				deleteDraft={vi.fn()}
			/>
		);

		const link = page.getByRole('link', { name: 'Anise cakes' });
		await expect
			.element(link)
			.toHaveAccessibleDescription('From photos Saved 3 hours ago Kept until November 14, 2026');
		await expect.element(link).toHaveAttribute('href', `/contribute?draft=${savedId}`);
	});

	it('deletes a draft from its row’s menu once asked, with the changes this browser kept for it', async () => {
		const deleteDraft = vi.fn<FormAction>(async () => ({ status: 'success' }));
		const continuingKey = `member:recipe-form:${memberId}:import:${continuedImportId}`;
		const keptKey = `member:recipe-form:${memberId}:draft:${savedId}`;
		localStorage.setItem(continuingKey, '{}');
		localStorage.setItem(keptKey, '{}');
		await render(
			<DraftList drafts={drafts} now={now} memberId={memberId} deleteDraft={deleteDraft} />
		);

		const dialog = await deleteFromMenu('Lemon bars');
		await expect.element(dialog).toHaveAccessibleName('Delete the draft of “Lemon bars”?');
		await dialog.getByRole('button', { name: 'Delete draft' }).click();

		await expect.poll(() => localStorage.getItem(continuingKey)).toBeNull();
		expect(deleteDraft.mock.calls[0]?.[1].get('draftId')).toBe(continuingId);
		expect(localStorage.getItem(keptKey)).toBe('{}');
		// The list stays, and the page renders again without the draft.
		expect(router.replace).not.toHaveBeenCalled();
	});

	it('returns focus to the row’s menu button when the member keeps the draft', async () => {
		const deleteDraft = vi.fn<FormAction>();
		await render(
			<DraftList drafts={drafts} now={now} memberId={memberId} deleteDraft={deleteDraft} />
		);

		const dialog = await deleteFromMenu('Untitled recipe');
		await expect.element(dialog).toHaveAccessibleName('Delete this draft?');
		await dialog.getByRole('button', { name: 'Keep draft' }).click();

		await expect.element(dialog).not.toBeInTheDocument();
		await expect
			.element(page.getByRole('button', { name: 'Actions for Untitled recipe' }))
			.toHaveFocus();
		expect(deleteDraft).not.toHaveBeenCalled();
	});

	it('deletes an import’s draft by its import', async () => {
		const deleteDraft = vi.fn<FormAction>(async () => ({ status: 'success' }));
		await render(
			<DraftList drafts={drafts} now={now} memberId={memberId} deleteDraft={deleteDraft} />
		);

		const dialog = await deleteFromMenu('Sheet-pan gnocchi');
		await dialog.getByRole('button', { name: 'Delete draft' }).click();

		await expect.poll(() => deleteDraft).toHaveBeenCalledOnce();
		expect(deleteDraft.mock.calls[0]?.[1].get('importId')).toBe(importId);
		expect(deleteDraft.mock.calls[0]?.[1].get('draftId')).toBeNull();
	});
});
