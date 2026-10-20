import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import type { FormAction } from '@/components/forms/form-state';
import { DraftPageHeading } from '@/components/recipe-form/draft-page-heading';
import { HeldDraftProvider, type HeldDraft } from '@/components/recipe-form/held-draft';
import { RecipeForm } from '@/components/recipe-form/recipe-form';
import type { SavedDraftResult } from '@/components/recipe-form/recipe-form-fields';
import { recipeFormValues } from '@/components/recipe-form/recipe-form-values';
import { HeldDraftMenu } from '@/components/recipe-form/subject-menus';
import type { RecipeFormDrafts } from '@/components/recipe-form/use-draft-saving';

const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));

vi.mock('next/navigation', async (importOriginal) => ({
	...(await importOriginal<typeof import('next/navigation')>()),
	useRouter: () => router,
}));

const openedId = '0199d2a0-1b2c-7d3e-8f40-000000000004';
const newId = '0199d2a0-1b2c-7d3e-8f40-000000000007';

const savedAt = new Date('2026-10-15T18:20:00.000Z');

// The form saves a second after the last change, so a wait for what a save shows allows for that.
const afterSaving = { timeout: 5_000 };

// A draft's page as the site composes it: the heading with its menu over the form, holding the draft
// the page opened, if any.
async function renderDraftPage({
	openedDraft,
	deleteDraft = vi.fn<FormAction>(),
}: {
	openedDraft?: HeldDraft;
	deleteDraft?: FormAction;
} = {}) {
	const save = vi.fn<FormAction<SavedDraftResult>>(async () => ({
		status: 'success',
		draftId: openedDraft?.id ?? newId,
		savedAt,
	}));
	const leave = vi.fn<RecipeFormDrafts['leave']>(async () => {});
	await render(
		<HeldDraftProvider opened={openedDraft}>
			<DraftPageHeading menu={<HeldDraftMenu action={deleteDraft} />} />
			<RecipeForm
				initial={recipeFormValues(
					openedDraft === undefined ? undefined : { title: openedDraft.title ?? '' }
				)}
				action={vi.fn()}
				uploadFolders={{ dish: 'dish/development/', scan: 'scan/development/' }}
				uploader={vi.fn()}
				drafts={{
					save,
					delete: deleteDraft,
					leave,
					opened:
						openedDraft === undefined
							? undefined
							: { id: openedDraft.id, savedAt: openedDraft.savedAt },
				}}
			/>
		</HeldDraftProvider>
	);
	return { save, leave };
}

function heading() {
	return page.getByRole('heading', { level: 1 });
}

function backLink() {
	return page.getByRole('link', { name: 'Back to Add a Recipe' });
}

afterEach(() => {
	vi.clearAllMocks();
	window.history.replaceState(null, '', '/');
});

describe('DraftPageHeading', () => {
	it('heads a new recipe as untitled, under the back link to the start page, with no menu', async () => {
		await renderDraftPage();

		await expect.element(heading()).toHaveTextContent('Untitled recipe');
		await expect.element(backLink()).toHaveAttribute('href', '/contribute');
		await expect
			.element(page.getByRole('button', { name: 'Draft actions' }))
			.not.toBeInTheDocument();
	});

	it('takes the title the form saves, and its back link then says the draft is kept', async () => {
		await renderDraftPage();
		await page.getByRole('textbox', { name: 'Title' }).fill('Pound cake');
		// What is typed shows in the heading once it is saved, as the list of drafts names it.
		await expect.element(heading()).toHaveTextContent('Untitled recipe');

		await expect.element(heading(), afterSaving).toHaveTextContent('Pound cake');
		await expect.element(backLink()).toHaveAttribute('href', `/contribute?kept=${newId}`);
		await expect.element(page.getByRole('button', { name: 'Draft actions' })).toBeVisible();
	});

	it('heads a draft the page opened by its title, and takes the title it is saved under again', async () => {
		await renderDraftPage({
			openedDraft: { id: openedId, title: 'Lemon bars', savedAt: new Date('2026-10-14') },
		});
		await expect.element(heading()).toHaveTextContent('Lemon bars');
		await expect.element(backLink()).toHaveAttribute('href', `/contribute?kept=${openedId}`);

		await page.getByRole('textbox', { name: 'Title' }).fill('Lemon squares');

		await expect.element(heading(), afterSaving).toHaveTextContent('Lemon squares');
	});

	it('leaves by its back link once the draft holds what was typed, naming the draft on the start page', async () => {
		const { save, leave } = await renderDraftPage();
		await page.getByRole('textbox', { name: 'Title' }).fill('Pound cake');

		await backLink().click();

		await expect.poll(() => leave).toHaveBeenCalledWith(newId, 'push');
		expect(save).toHaveBeenCalledOnce();
	});

	it('leaves for the start page once its menu deletes the draft, which it then no longer names', async () => {
		const deleteDraft = vi.fn<FormAction>(async () => ({ status: 'success' }));
		const { leave } = await renderDraftPage({
			openedDraft: { id: openedId, title: 'Lemon bars', savedAt: new Date('2026-10-14') },
			deleteDraft,
		});

		await page.getByRole('button', { name: 'Draft actions' }).click();
		await page.getByRole('menuitem', { name: 'Delete draft' }).click();
		await page.getByRole('alertdialog').getByRole('button', { name: 'Delete draft' }).click();

		await expect.poll(() => leave).toHaveBeenCalledWith(undefined, 'replace');
		expect(deleteDraft.mock.calls[0]?.[1].get('draftId')).toBe(openedId);
		expect(deleteDraft.mock.calls[0]?.[1].get('draftVersion')).toBe(
			new Date('2026-10-14').toISOString()
		);
		await expect.element(backLink()).toHaveAttribute('href', '/contribute');
	});
});
