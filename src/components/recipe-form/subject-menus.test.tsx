import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
async function openMenu(user: ReturnType<typeof userEvent.setup>, name: string) {
	await user.click(screen.getByRole('button', { name }));
	return screen.findByRole('menu');
}

function itemNames(menu: HTMLElement): (string | null)[] {
	return within(menu)
		.getAllByRole('menuitem')
		.map((item) => item.textContent);
}

// Chooses the item from the menu its button names, and returns the dialog it opens.
async function choose(user: ReturnType<typeof userEvent.setup>, name: string, item: string) {
	await user.click(within(await openMenu(user, name)).getByRole('menuitem', { name: item }));
	return screen.findByRole('alertdialog');
}

afterEach(() => {
	vi.clearAllMocks();
	localStorage.clear();
});

describe('EditedRecipeMenu', () => {
	it('holds View recipe, a link to the recipe, then Delete recipe', async () => {
		const user = userEvent.setup();
		render(<EditedRecipeMenu recipe={lemonBars} memberId={memberId} action={succeed} />);

		const menu = await openMenu(user, 'Recipe actions');

		expect(itemNames(menu)).toEqual(['View recipe', 'Delete recipe']);
		expect(within(menu).getByRole('menuitem', { name: 'View recipe' }).getAttribute('href')).toBe(
			'/recipes/lemon-bars'
		);
	});

	it('deletes the recipe once confirmed, with its unsaved changes and no others, and leaves for the list', async () => {
		const user = userEvent.setup();
		const action = vi.fn(succeed);
		localStorage.setItem(recipeKey, '{}');
		localStorage.setItem(draftKey, '{}');
		let entryAsItLeft: string | null | undefined;
		router.replace.mockImplementation(() => {
			entryAsItLeft = localStorage.getItem(recipeKey);
		});
		render(<EditedRecipeMenu recipe={lemonBars} memberId={memberId} action={action} />);

		const dialog = await choose(user, 'Recipe actions', 'Delete recipe');
		expect(within(dialog).getByText('Delete “Lemon bars”?')).toBeDefined();
		await user.click(within(dialog).getByRole('button', { name: 'Delete recipe' }));

		await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
		expect(action.mock.calls[0]?.[1].get('recipeId')).toBe(recipeId);
		expect(entryAsItLeft).toBeNull();
		expect(localStorage.getItem(draftKey)).toBe('{}');
	});

	it('shows why a delete was refused, and stays', async () => {
		const user = userEvent.setup();
		localStorage.setItem(recipeKey, '{}');
		render(<EditedRecipeMenu recipe={lemonBars} memberId={memberId} action={refuse} />);

		const dialog = await choose(user, 'Recipe actions', 'Delete recipe');
		await user.click(within(dialog).getByRole('button', { name: 'Delete recipe' }));

		expect(
			await within(dialog).findByText('We couldn’t delete it. Reload the page and try again.')
		).toBeDefined();
		expect(router.replace).not.toHaveBeenCalled();
		expect(localStorage.getItem(recipeKey)).toBe('{}');
	});

	it('returns focus to the menu’s button when the dialog is cancelled', async () => {
		const user = userEvent.setup();
		const action = vi.fn(succeed);
		render(<EditedRecipeMenu recipe={lemonBars} memberId={memberId} action={action} />);

		const dialog = await choose(user, 'Recipe actions', 'Delete recipe');
		await user.click(within(dialog).getByRole('button', { name: 'Keep recipe' }));

		await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
		await waitFor(() =>
			expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Recipe actions' }))
		);
		expect(action).not.toHaveBeenCalled();
	});
});

describe('DraftMenu', () => {
	it('deletes an import’s draft by its import, with the review’s unsaved changes, and leaves for the drafts left', async () => {
		const user = userEvent.setup();
		const action = vi.fn(succeed);
		localStorage.setItem(importKey, '{}');
		render(
			<DraftMenu
				label="Draft actions"
				draft={{ kind: 'import', id: importId }}
				title="Lemon bars"
				formSubject={{ kind: 'import', importId }}
				memberId={memberId}
				action={action}
				leavesFor="/contribute?tab=drafts"
			/>
		);

		expect(itemNames(await openMenu(user, 'Draft actions'))).toEqual(['Delete draft']);
		await user.keyboard('{Escape}');
		const dialog = await choose(user, 'Draft actions', 'Delete draft');
		expect(within(dialog).getByText('Delete the draft of “Lemon bars”?')).toBeDefined();
		await user.click(within(dialog).getByRole('button', { name: 'Delete draft' }));

		await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/contribute?tab=drafts'));
		expect(action.mock.calls[0]?.[1].get('importId')).toBe(importId);
		expect(action.mock.calls[0]?.[1].get('draftId')).toBeNull();
		expect(localStorage.getItem(importKey)).toBeNull();
	});

	it('stays where nothing to leave for is given, as a list does', async () => {
		const user = userEvent.setup();
		const action = vi.fn(succeed);
		render(
			<DraftMenu
				label="Actions for Lemon bars"
				draft={{ kind: 'saved', id: draftId }}
				title="Lemon bars"
				formSubject={{ kind: 'draft', draftId }}
				memberId={memberId}
				action={action}
			/>
		);

		const dialog = await choose(user, 'Actions for Lemon bars', 'Delete draft');
		await user.click(within(dialog).getByRole('button', { name: 'Delete draft' }));

		await waitFor(() => expect(action).toHaveBeenCalledOnce());
		expect(action.mock.calls[0]?.[1].get('draftId')).toBe(draftId);
		expect(router.replace).not.toHaveBeenCalled();
	});

	it('asks about an untitled draft as this draft', async () => {
		const user = userEvent.setup();
		render(
			<DraftMenu
				label="Draft actions"
				draft={{ kind: 'saved', id: draftId }}
				title={undefined}
				formSubject={{ kind: 'draft', draftId }}
				memberId={memberId}
				action={refuse}
			/>
		);

		const dialog = await choose(user, 'Draft actions', 'Delete draft');

		expect(within(dialog).getByText('Delete this draft?')).toBeDefined();
	});
});

describe('HeldDraftMenu', () => {
	it('shows nothing while the page’s form holds no saved draft', () => {
		render(
			<HeldDraftProvider opened={undefined}>
				<HeldDraftMenu memberId={memberId} action={succeed} />
			</HeldDraftProvider>
		);

		expect(screen.queryByRole('button')).toBeNull();
	});

	it('deletes the saved draft the page opened, with its unsaved changes, and leaves for the drafts left', async () => {
		const user = userEvent.setup();
		const action = vi.fn(succeed);
		localStorage.setItem(draftKey, '{}');
		render(
			<HeldDraftProvider opened={{ id: draftId, title: 'Lemon bars' }}>
				<HeldDraftMenu memberId={memberId} action={action} />
			</HeldDraftProvider>
		);

		const dialog = await choose(user, 'Draft actions', 'Delete draft');
		expect(within(dialog).getByText('Delete the draft of “Lemon bars”?')).toBeDefined();
		await user.click(within(dialog).getByRole('button', { name: 'Delete draft' }));

		await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/contribute?tab=drafts'));
		expect(action.mock.calls[0]?.[1].get('draftId')).toBe(draftId);
		expect(localStorage.getItem(draftKey)).toBeNull();
	});
});
