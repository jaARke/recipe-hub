import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { page, userEvent } from 'vitest/browser';
import type { FormAction } from '@/components/forms/form-state';
import {
	HeldDraftProvider,
	useProvideHeldDraftControls,
	type HeldDraftControls,
} from '@/components/recipe-form/held-draft';
import { DraftMenu, EditedRecipeMenu, HeldDraftMenu } from '@/components/recipe-form/subject-menus';

const router = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock('next/navigation', async (importOriginal) => ({
	...(await importOriginal<typeof import('next/navigation')>()),
	useRouter: () => router,
}));

const memberId = '3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b';
const recipeId = '0b6f3c7e-3c1a-4d8e-9a57-2f1d6b8e4c10';
const draftId = '0199c7a4-2c3e-7b1a-9f00-2a7c1e4b5d6e';

const recipeKey = `member:recipe-form:${memberId}:recipe:${recipeId}`;
const otherRecipeKey = `member:recipe-form:${memberId}:recipe:0b6f3c7e-3c1a-4d8e-9a57-2f1d6b8e4c11`;

const succeed: FormAction = async () => ({ status: 'success' });

const refuse: FormAction = async () => ({
	status: 'error',
	message: 'We couldn’t delete it. Reload the page and try again.',
	fieldErrors: {},
});

const lemonBars = { id: recipeId, slug: 'lemon-bars', title: 'Lemon bars' };

// Opens the menu its button names, and returns it.
async function openMenu(name: string) {
	await page.getByRole('button', { name }).click();
	const menu = page.getByRole('menu');
	await expect.element(menu).toBeVisible();
	return menu;
}

// Chooses the item from the menu its button names, and returns the dialog it opens, which its
// question names.
async function choose(name: string, item: string, question: string) {
	await (await openMenu(name)).getByRole('menuitem', { name: item }).click();
	const dialog = page.getByRole('alertdialog', { name: question });
	await expect.element(dialog).toBeVisible();
	return dialog;
}

afterEach(() => {
	localStorage.clear();
});

describe('EditedRecipeMenu', () => {
	it('holds View recipe, a link to the recipe, then Delete recipe', async () => {
		await render(<EditedRecipeMenu recipe={lemonBars} memberId={memberId} action={succeed} />);

		const menu = await openMenu('Recipe actions');

		expect(
			menu
				.getByRole('menuitem')
				.elements()
				.map((item) => item.textContent)
		).toEqual(['View recipe', 'Delete recipe']);
		await expect
			.element(menu.getByRole('menuitem', { name: 'View recipe' }))
			.toHaveAttribute('href', '/recipes/lemon-bars');
	});

	it('deletes the recipe once confirmed, with its unsaved changes and no others, and leaves for the list', async () => {
		const action = vi.fn(succeed);
		localStorage.setItem(recipeKey, '{}');
		localStorage.setItem(otherRecipeKey, '{}');
		let entryAsItLeft: string | null | undefined;
		router.replace.mockImplementation(() => {
			entryAsItLeft = localStorage.getItem(recipeKey);
		});
		await render(<EditedRecipeMenu recipe={lemonBars} memberId={memberId} action={action} />);

		const dialog = await choose('Recipe actions', 'Delete recipe', 'Delete “Lemon bars”?');
		await dialog.getByRole('button', { name: 'Delete recipe' }).click();

		await expect.poll(() => router.replace).toHaveBeenCalledWith('/');
		expect(action.mock.calls[0]?.[1].get('recipeId')).toBe(recipeId);
		expect(entryAsItLeft).toBeNull();
		expect(localStorage.getItem(otherRecipeKey)).toBe('{}');
	});

	it('shows why a delete was refused, and stays', async () => {
		localStorage.setItem(recipeKey, '{}');
		await render(<EditedRecipeMenu recipe={lemonBars} memberId={memberId} action={refuse} />);

		const dialog = await choose('Recipe actions', 'Delete recipe', 'Delete “Lemon bars”?');
		await dialog.getByRole('button', { name: 'Delete recipe' }).click();

		await expect
			.element(dialog.getByText('We couldn’t delete it. Reload the page and try again.'))
			.toBeVisible();
		expect(router.replace).not.toHaveBeenCalled();
		expect(localStorage.getItem(recipeKey)).toBe('{}');
	});

	it('returns focus to the menu’s button when the dialog is cancelled', async () => {
		const action = vi.fn(succeed);
		await render(<EditedRecipeMenu recipe={lemonBars} memberId={memberId} action={action} />);

		const dialog = await choose('Recipe actions', 'Delete recipe', 'Delete “Lemon bars”?');
		await dialog.getByRole('button', { name: 'Keep recipe' }).click();

		await expect.element(page.getByRole('alertdialog')).not.toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Recipe actions' })).toHaveFocus();
		expect(action).not.toHaveBeenCalled();
	});
});

describe('DraftMenu', () => {
	const savedAt = new Date('2026-10-15T19:12:00.000Z');

	it('deletes the draft at the version the page shows once confirmed, and stays, as a list does', async () => {
		const action = vi.fn(succeed);
		await render(
			<DraftMenu
				label="Actions for Lemon bars"
				draftId={draftId}
				title="Lemon bars"
				savedAt={savedAt}
				action={action}
			/>
		);

		const menu = await openMenu('Actions for Lemon bars');
		expect(
			menu
				.getByRole('menuitem')
				.elements()
				.map((item) => item.textContent)
		).toEqual(['Delete draft']);
		await userEvent.keyboard('{Escape}');
		const dialog = await choose(
			'Actions for Lemon bars',
			'Delete draft',
			'Delete the draft of “Lemon bars”?'
		);
		await dialog.getByRole('button', { name: 'Delete draft' }).click();

		await expect.poll(() => action).toHaveBeenCalledOnce();
		expect(action.mock.calls[0]?.[1].get('draftId')).toBe(draftId);
		expect(action.mock.calls[0]?.[1].get('draftVersion')).toBe('2026-10-15T19:12:00.000Z');
		await expect.element(page.getByRole('alertdialog')).not.toBeInTheDocument();
		expect(router.replace).not.toHaveBeenCalled();
	});

	it('shows why a delete was refused, and stays open', async () => {
		await render(
			<DraftMenu
				label="Draft actions"
				draftId={draftId}
				title="Lemon bars"
				savedAt={savedAt}
				action={refuse}
			/>
		);

		const dialog = await choose(
			'Draft actions',
			'Delete draft',
			'Delete the draft of “Lemon bars”?'
		);
		await dialog.getByRole('button', { name: 'Delete draft' }).click();

		await expect
			.element(dialog.getByText('We couldn’t delete it. Reload the page and try again.'))
			.toBeVisible();
	});

	it('asks about an untitled draft as this draft', async () => {
		await render(
			<DraftMenu
				label="Draft actions"
				draftId={draftId}
				title={undefined}
				savedAt={savedAt}
				action={refuse}
			/>
		);

		await (await openMenu('Draft actions')).getByRole('menuitem', { name: 'Delete draft' }).click();

		await expect
			.element(page.getByRole('alertdialog', { name: 'Delete this draft?' }))
			.toBeVisible();
	});
});

// Shares controls as the page's recipe form does, whose delete adds what it names to the action's.
function FormControls({ deleting }: { deleting: HeldDraftControls['deleting'] }) {
	const controls = React.useMemo(() => ({ finishLater: vi.fn(), deleting }), [deleting]);
	useProvideHeldDraftControls(controls);
	return null;
}

describe('HeldDraftMenu', () => {
	const opened = {
		id: draftId,
		title: 'Lemon bars',
		savedAt: new Date('2026-10-15T19:12:00.000Z'),
	};

	async function confirmDelete() {
		const dialog = await choose(
			'Draft actions',
			'Delete draft',
			'Delete the draft of “Lemon bars”?'
		);
		await dialog.getByRole('button', { name: 'Delete draft' }).click();
	}

	it('deletes the draft the page holds through its form, which names the version it holds', async () => {
		const action = vi.fn(succeed);
		const deleting = vi.fn<HeldDraftControls['deleting']>((remove) => async (state, formData) => {
			formData.set('draftVersion', '2026-10-15T19:13:00.000Z');
			return remove(state, formData);
		});
		await render(
			<HeldDraftProvider opened={opened}>
				<FormControls deleting={deleting} />
				<HeldDraftMenu action={action} />
			</HeldDraftProvider>
		);

		await confirmDelete();

		await expect.poll(() => action).toHaveBeenCalledOnce();
		expect(deleting).toHaveBeenCalledWith(action);
		expect(action.mock.calls[0]?.[1].get('draftId')).toBe(draftId);
		expect(action.mock.calls[0]?.[1].get('draftVersion')).toBe('2026-10-15T19:13:00.000Z');
		// The page lets go of the draft, so the menu goes with it.
		await expect
			.element(page.getByRole('button', { name: 'Draft actions' }))
			.not.toBeInTheDocument();
	});

	it('deletes the draft as the page opened it where no form shares controls', async () => {
		const action = vi.fn(succeed);
		await render(
			<HeldDraftProvider opened={opened}>
				<HeldDraftMenu action={action} />
			</HeldDraftProvider>
		);

		await confirmDelete();

		await expect.poll(() => action).toHaveBeenCalledOnce();
		expect(action.mock.calls[0]?.[1].get('draftVersion')).toBe('2026-10-15T19:12:00.000Z');
	});

	it('offers nothing while the page holds no draft', async () => {
		await render(
			<HeldDraftProvider opened={undefined}>
				<HeldDraftMenu action={succeed} />
			</HeldDraftProvider>
		);

		await expect
			.element(page.getByRole('button', { name: 'Draft actions' }))
			.not.toBeInTheDocument();
	});
});
