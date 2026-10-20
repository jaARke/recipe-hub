import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { page, userEvent } from 'vitest/browser';
import type { FormAction } from '@/components/forms/form-state';
import { HeldDraftProvider } from '@/components/recipe-form/held-draft';
import { DraftMenu, EditedRecipeMenu, HeldDraftMenu } from '@/components/recipe-form/subject-menus';

const router = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock('next/navigation', async (importOriginal) => ({
	...(await importOriginal<typeof import('next/navigation')>()),
	useRouter: () => router,
}));

const memberId = '3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b';
const recipeId = '0b6f3c7e-3c1a-4d8e-9a57-2f1d6b8e4c10';
const draftId = '0199c7a4-2c3e-7b1a-9f00-2a7c1e4b5d6e';
const importId = '6d2b9f4a-8e1c-4b7d-a3f5-1c9e7d2b6a84';

const recipeKey = `member:recipe-form:${memberId}:recipe:${recipeId}`;
const draftKey = `member:recipe-form:${memberId}:draft:${draftId}`;
const importKey = `member:recipe-form:${memberId}:import:${importId}`;

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
		localStorage.setItem(draftKey, '{}');
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
		expect(localStorage.getItem(draftKey)).toBe('{}');
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
	it('deletes an import’s draft by its import, with the review’s unsaved changes, and leaves for the start page', async () => {
		const action = vi.fn(succeed);
		localStorage.setItem(importKey, '{}');
		await render(
			<DraftMenu
				label="Draft actions"
				draft={{ kind: 'import', id: importId }}
				title="Lemon bars"
				formSubject={{ kind: 'import', importId }}
				memberId={memberId}
				action={action}
				leavesFor="/contribute"
			/>
		);

		const menu = await openMenu('Draft actions');
		expect(
			menu
				.getByRole('menuitem')
				.elements()
				.map((item) => item.textContent)
		).toEqual(['Delete draft']);
		await userEvent.keyboard('{Escape}');
		const dialog = await choose(
			'Draft actions',
			'Delete draft',
			'Delete the draft of “Lemon bars”?'
		);
		await dialog.getByRole('button', { name: 'Delete draft' }).click();

		await expect.poll(() => router.replace).toHaveBeenCalledWith('/contribute');
		expect(action.mock.calls[0]?.[1].get('importId')).toBe(importId);
		expect(action.mock.calls[0]?.[1].get('draftId')).toBeNull();
		expect(localStorage.getItem(importKey)).toBeNull();
	});

	it('stays where nothing to leave for is given, as a list does', async () => {
		const action = vi.fn(succeed);
		await render(
			<DraftMenu
				label="Actions for Lemon bars"
				draft={{ kind: 'saved', id: draftId }}
				title="Lemon bars"
				formSubject={{ kind: 'draft', draftId }}
				memberId={memberId}
				action={action}
			/>
		);

		const dialog = await choose(
			'Actions for Lemon bars',
			'Delete draft',
			'Delete the draft of “Lemon bars”?'
		);
		await dialog.getByRole('button', { name: 'Delete draft' }).click();

		await expect.poll(() => action).toHaveBeenCalledOnce();
		expect(action.mock.calls[0]?.[1].get('draftId')).toBe(draftId);
		expect(router.replace).not.toHaveBeenCalled();
	});

	it('asks about an untitled draft as this draft', async () => {
		await render(
			<DraftMenu
				label="Draft actions"
				draft={{ kind: 'saved', id: draftId }}
				title={undefined}
				formSubject={{ kind: 'draft', draftId }}
				memberId={memberId}
				action={refuse}
			/>
		);

		await (await openMenu('Draft actions')).getByRole('menuitem', { name: 'Delete draft' }).click();

		await expect
			.element(page.getByRole('alertdialog', { name: 'Delete this draft?' }))
			.toBeVisible();
	});
});

describe('HeldDraftMenu', () => {
	it('deletes the saved draft the page opened, with its unsaved changes, and leaves for the start page', async () => {
		const action = vi.fn(succeed);
		localStorage.setItem(draftKey, '{}');
		await render(
			<HeldDraftProvider opened={{ id: draftId, title: 'Lemon bars' }}>
				<HeldDraftMenu memberId={memberId} action={action} />
			</HeldDraftProvider>
		);

		const dialog = await choose(
			'Draft actions',
			'Delete draft',
			'Delete the draft of “Lemon bars”?'
		);
		await dialog.getByRole('button', { name: 'Delete draft' }).click();

		await expect.poll(() => router.replace).toHaveBeenCalledWith('/contribute');
		expect(action.mock.calls[0]?.[1].get('draftId')).toBe(draftId);
		expect(localStorage.getItem(draftKey)).toBeNull();
	});
});
