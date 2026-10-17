import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import type { SavedDraftId } from '@/application/drafts/saved-draft';
import type { DraftSummaryDto } from '@/application/drafts/saved-draft-dtos';
import { holdPageLoads } from '@/components/auth/testing/page-loads';
import type { FormAction } from '@/components/forms/form-state';
import { HeldDraftProvider, type HeldDraft } from '@/components/recipe-form/held-draft';
import { RecipeForm } from '@/components/recipe-form/recipe-form';
import type { SavedDraftResult } from '@/components/recipe-form/recipe-form-fields';
import { recipeFormValues } from '@/components/recipe-form/recipe-form-values';
import { HeldDraftMenu } from '@/components/recipe-form/subject-menus';
import { RecipeEntryTabs } from '@/components/recipe-import/recipe-entry-tabs';
import type { RecipeImportId } from '@/domain/recipe/recipe-import';

const router = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock('next/navigation', async (importOriginal) => ({
	...(await importOriginal<typeof import('next/navigation')>()),
	useRouter: () => router,
}));

const memberId = '3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b';
const importId = '0199d2a0-1b2c-7d3e-8f40-000000000003' as RecipeImportId;
const openedId = '0199d2a0-1b2c-7d3e-8f40-000000000004' as SavedDraftId;
const newId = '0199d2a0-1b2c-7d3e-8f40-000000000007' as SavedDraftId;

// When the page rendered, and when the form saves its draft after.
const now = new Date('2026-10-15T18:00:00.000Z');
const savedAt = new Date('2026-10-15T18:20:00.000Z');
const expiresAt = new Date('2026-11-14T18:20:00.000Z');

// An import from photos this morning, then a draft saved yesterday that kept its import's source.
const imported: DraftSummaryDto = {
	kind: 'import',
	id: importId,
	mode: 'photo',
	title: 'Anise cakes',
	importedAt: new Date('2026-10-15T09:00:00.000Z'),
	expiresAt: new Date('2026-10-22T09:00:00.000Z'),
};
const opened: DraftSummaryDto = {
	kind: 'saved',
	id: openedId,
	mode: 'url',
	title: 'Lemon bars',
	savedAt: new Date('2026-10-14T18:00:00.000Z'),
	expiresAt: new Date('2026-11-13T18:00:00.000Z'),
};

// Saves every draft as the id given, at the one moment.
function savingAs(draftId: SavedDraftId) {
	return vi.fn<FormAction<SavedDraftResult>>(async () => ({
		status: 'success',
		draftId,
		savedAt,
		expiresAt,
	}));
}

// The add page as it composes the tabs: the manual form, holding the draft the page opened if any,
// beside the drafts the page listed.
async function renderAddPage({
	drafts,
	openedDraft,
	save,
	deleteDraft = vi.fn<FormAction>(),
}: {
	drafts: readonly DraftSummaryDto[];
	openedDraft?: HeldDraft & { savedAt: Date };
	save: FormAction<SavedDraftResult>;
	deleteDraft?: FormAction;
}) {
	await render(
		<HeldDraftProvider opened={openedDraft}>
			<HeldDraftMenu memberId={memberId} action={deleteDraft} />
			<RecipeEntryTabs
				forms={{
					manual: (
						<RecipeForm
							initial={recipeFormValues(
								openedDraft === undefined ? undefined : { title: openedDraft.title ?? '' }
							)}
							action={vi.fn()}
							uploadFolders={{ dish: 'dish/development/', scan: 'scan/development/' }}
							tagLabels={[]}
							uploader={vi.fn()}
							autosave={{ memberId }}
							drafts={{
								save,
								opened:
									openedDraft === undefined
										? undefined
										: { id: openedDraft.id, savedAt: openedDraft.savedAt },
								inUrl: true,
							}}
							submitLabel="Save recipe"
						/>
					),
					url: null,
					photo: null,
				}}
				defaultTab="manual"
				drafts={drafts}
				now={now}
				memberId={memberId}
				deleteDraft={deleteDraft}
			/>
		</HeldDraftProvider>
	);
}

// The Drafts tab, which reads its count after its name, as "Drafts, 2".
function draftsTab() {
	return page.getByRole('tab', { name: /^Drafts/ });
}

function title() {
	return page.getByRole('textbox', { name: 'Title' });
}

// Saves the form as a draft, from the button a phone's width calls Save draft, and waits until the
// action bar says so.
async function saveAsDraft() {
	await page.getByRole('button', { name: 'Save draft' }).click();
	await expect.element(page.getByText(/^Draft saved at /)).toBeInTheDocument();
}

// Each listed draft's link in order, by the title that names it and where it leads.
function listedDrafts() {
	return page
		.getByRole('list')
		.getByRole('link')
		.elements()
		.map((link) => ({
			name: document.getElementById(link.getAttribute('aria-labelledby') ?? '')?.textContent,
			href: link.getAttribute('href'),
		}));
}

afterEach(() => {
	vi.clearAllMocks();
	localStorage.clear();
	window.history.replaceState(null, '', '/');
});

describe('RecipeEntryTabs', () => {
	it('lists a draft the form just saved first, and counts it, without the page loading again', async () => {
		const loads = holdPageLoads();
		await renderAddPage({ drafts: [imported], save: savingAs(newId) });
		await expect.element(draftsTab()).toHaveTextContent('Drafts, 1');
		await title().fill('Pound cake');

		await saveAsDraft();
		await draftsTab().click();

		await expect.element(draftsTab()).toHaveTextContent('Drafts, 2');
		await expect
			.element(page.getByRole('link', { name: 'Pound cake' }))
			.toHaveAccessibleDescription('Saved draft Saved just now Kept until November 14, 2026');
		expect(listedDrafts()).toEqual([
			{ name: 'Pound cake', href: `/contribute?draft=${newId}` },
			{ name: 'Anise cakes', href: `/contribute/imports/${importId}` },
		]);
		expect(loads).toEqual([]);
	});

	it('lists a draft the page opened as the page did, then as saved again in its place, still saying where it came from', async () => {
		await renderAddPage({
			drafts: [imported, opened],
			openedDraft: { id: openedId, title: 'Lemon bars', savedAt: opened.savedAt },
			save: savingAs(openedId),
		});
		await draftsTab().click();
		await expect
			.element(page.getByRole('link', { name: 'Lemon bars' }))
			.toHaveAccessibleDescription('From a link Saved yesterday Kept until November 13, 2026');
		await page.getByRole('tab', { name: 'Manual' }).click();
		await title().fill('Lemon squares');

		await saveAsDraft();
		await draftsTab().click();

		await expect.element(draftsTab()).toHaveTextContent('Drafts, 2');
		expect(listedDrafts()).toEqual([
			{ name: 'Anise cakes', href: `/contribute/imports/${importId}` },
			{ name: 'Lemon squares', href: `/contribute?draft=${openedId}` },
		]);
		await expect
			.element(page.getByRole('link', { name: 'Lemon squares' }))
			.toHaveAccessibleDescription('From a link Saved just now Kept until November 14, 2026');
	});

	it('stops listing a draft the form saved once it is deleted from the list', async () => {
		const deleteDraft = vi.fn<FormAction>(async () => ({ status: 'success' }));
		await renderAddPage({ drafts: [imported], save: savingAs(newId), deleteDraft });
		await title().fill('Pound cake');
		await saveAsDraft();
		await draftsTab().click();

		await page.getByRole('button', { name: 'Actions for Pound cake' }).click();
		await page.getByRole('menuitem', { name: 'Delete draft' }).click();
		await page.getByRole('alertdialog').getByRole('button', { name: 'Delete draft' }).click();

		await expect.element(draftsTab()).toHaveTextContent('Drafts, 1');
		expect(listedDrafts()).toEqual([
			{ name: 'Anise cakes', href: `/contribute/imports/${importId}` },
		]);
		expect(deleteDraft.mock.calls[0]?.[1].get('draftId')).toBe(newId);
		// Nothing is left for the heading's menu to delete.
		await expect
			.element(page.getByRole('button', { name: 'Draft actions' }))
			.not.toBeInTheDocument();
	});
});
