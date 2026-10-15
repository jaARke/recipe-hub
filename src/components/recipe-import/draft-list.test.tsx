import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

// A draft saved this morning with no title, one continuing an import, and an import from a link.
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

function rows(): HTMLElement[] {
	return screen.getAllByRole('listitem');
}

// Chooses Delete draft from the row's menu, which its button names by the draft, and returns the
// dialog that asks first.
async function deleteFromMenu(user: ReturnType<typeof userEvent.setup>, name: string) {
	await user.click(screen.getByRole('button', { name: `Actions for ${name}` }));
	const menu = await screen.findByRole('menu');
	expect(
		within(menu)
			.getAllByRole('menuitem')
			.map((item) => item.textContent)
	).toEqual(['Delete draft']);
	await user.click(within(menu).getByRole('menuitem', { name: 'Delete draft' }));
	return screen.findByRole('alertdialog');
}

afterEach(() => {
	vi.restoreAllMocks();
	localStorage.clear();
});

describe('DraftList', () => {
	it('says how long drafts stay when there are none', () => {
		render(<DraftList drafts={[]} now={now} memberId={memberId} deleteDraft={vi.fn()} />);

		expect(screen.getByText('No drafts')).toBeDefined();
		expect(
			screen.getByText(
				'A draft you save stays here for 30 days after your last save, and an import you haven’t saved for 7 days.'
			)
		).toBeDefined();
	});

	it('lists each draft with its title, when it was saved, and when it goes, opening where it continues', () => {
		render(<DraftList drafts={drafts} now={now} memberId={memberId} deleteDraft={vi.fn()} />);

		expect(rows().map((row) => row.querySelector('p')?.textContent)).toEqual([
			'Untitled recipe',
			'Lemon bars',
			'Sheet-pan gnocchi',
		]);
		const [untitled, continuing, imported] = rows() as [HTMLElement, HTMLElement, HTMLElement];
		expect(within(untitled).getByText('Saved draft')).toBeDefined();
		expect(within(untitled).getByText('3 hours ago').closest('p')?.textContent).toBe(
			'Saved 3 hours ago'
		);
		expect(within(untitled).getByText(/^Kept until/).textContent).toBe(
			'Kept until November 14, 2026'
		);
		expect(within(imported).getByText('From a link')).toBeDefined();
		expect(within(imported).getByText(/^Imported/).textContent).toBe('Imported 2 days ago');
		expect(
			[untitled, continuing, imported].map((row) =>
				within(row).getByRole('link', { name: /^Open/ }).getAttribute('href')
			)
		).toEqual([
			`/contribute?draft=${savedId}`,
			`/contribute/imports/${continuedImportId}`,
			`/contribute/imports/${importId}`,
		]);
		expect(within(continuing).getByRole('link', { name: 'Open Lemon bars' })).toBeDefined();
	});

	it('deletes a draft from its row’s menu once asked, with the changes this browser kept for it', async () => {
		const user = userEvent.setup();
		const deleteDraft = vi.fn<FormAction>(async () => ({ status: 'success' }));
		const continuingKey = `member:recipe-form:${memberId}:import:${continuedImportId}`;
		const keptKey = `member:recipe-form:${memberId}:draft:${savedId}`;
		localStorage.setItem(continuingKey, '{}');
		localStorage.setItem(keptKey, '{}');
		render(<DraftList drafts={drafts} now={now} memberId={memberId} deleteDraft={deleteDraft} />);

		const dialog = await deleteFromMenu(user, 'Lemon bars');
		expect(within(dialog).getByText('Delete the draft of “Lemon bars”?')).toBeDefined();
		await user.click(within(dialog).getByRole('button', { name: 'Delete draft' }));

		await waitFor(() => expect(localStorage.getItem(continuingKey)).toBeNull());
		expect(deleteDraft.mock.calls[0]?.[1].get('draftId')).toBe(continuingId);
		expect(localStorage.getItem(keptKey)).toBe('{}');
		// The list stays, and the page renders again without the draft.
		expect(router.replace).not.toHaveBeenCalled();
	});

	it('deletes an import’s draft by its import', async () => {
		const user = userEvent.setup();
		const deleteDraft = vi.fn<FormAction>(async () => ({ status: 'success' }));
		render(<DraftList drafts={drafts} now={now} memberId={memberId} deleteDraft={deleteDraft} />);

		const dialog = await deleteFromMenu(user, 'Sheet-pan gnocchi');
		await user.click(within(dialog).getByRole('button', { name: 'Delete draft' }));

		await waitFor(() => expect(deleteDraft).toHaveBeenCalledOnce());
		expect(deleteDraft.mock.calls[0]?.[1].get('importId')).toBe(importId);
		expect(deleteDraft.mock.calls[0]?.[1].get('draftId')).toBeNull();
	});
});
