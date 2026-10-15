import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { FormAction } from '@/components/forms/form-state';
import { DeleteDraftDialog } from '@/components/recipe-form/delete-draft-dialog';
import { DeleteRecipeDialog } from '@/components/recipe-form/delete-recipe-dialog';

const recipeId = '0b6f3c7e-3c1a-4d8e-9a57-2f1d6b8e4c10';
const draftId = '0199c7a4-2c3e-7b1a-9f00-2a7c1e4b5d6e';

const succeed: FormAction = async () => ({ status: 'success' });

const refuse: FormAction = async () => ({
	status: 'error',
	message: 'We couldn’t delete it. Reload the page and try again.',
	fieldErrors: {},
});

async function confirm(trigger: string, confirmLabel: string) {
	const user = userEvent.setup();
	await user.click(screen.getByRole('button', { name: trigger }));
	await user.click(
		within(await screen.findByRole('alertdialog')).getByRole('button', { name: confirmLabel })
	);
}

describe('DeleteRecipeDialog', () => {
	it('sends the recipe, and says once it is deleted', async () => {
		const action = vi.fn(succeed);
		const onDeleted = vi.fn();
		render(
			<DeleteRecipeDialog
				recipeId={recipeId}
				title="Lemon bars"
				action={action}
				onDeleted={onDeleted}
			/>
		);

		await confirm('Delete recipe', 'Delete recipe');

		await waitFor(() => expect(onDeleted).toHaveBeenCalledOnce());
		expect(action.mock.calls[0]?.[1].get('recipeId')).toBe(recipeId);
	});

	it('says nothing when the delete is refused', async () => {
		const onDeleted = vi.fn();
		render(
			<DeleteRecipeDialog
				recipeId={recipeId}
				title="Lemon bars"
				action={refuse}
				onDeleted={onDeleted}
			/>
		);

		await confirm('Delete recipe', 'Delete recipe');

		expect(
			await screen.findByText('We couldn’t delete it. Reload the page and try again.')
		).toBeDefined();
		expect(onDeleted).not.toHaveBeenCalled();
	});
});

describe('DeleteDraftDialog', () => {
	it.each([
		[{ kind: 'saved', id: draftId } as const, 'draftId'],
		[{ kind: 'import', id: draftId } as const, 'importId'],
	])(
		'sends the draft %o as %s, named by its title, and says once it is deleted',
		async (draft, field) => {
			const action = vi.fn(succeed);
			const onDeleted = vi.fn();
			render(
				<DeleteDraftDialog draft={draft} title="Lemon bars" action={action} onDeleted={onDeleted} />
			);

			await confirm('Delete draft', 'Delete draft');

			await waitFor(() => expect(onDeleted).toHaveBeenCalledOnce());
			expect(screen.queryByText('Delete the draft of “Lemon bars”?')).toBeNull();
			expect(action.mock.calls[0]?.[1].get(field)).toBe(draftId);
		}
	);

	it('asks about an untitled draft as this draft', async () => {
		const user = userEvent.setup();
		render(
			<DeleteDraftDialog
				draft={{ kind: 'saved', id: draftId }}
				title={undefined}
				action={refuse}
				onDeleted={vi.fn()}
			/>
		);

		await user.click(screen.getByRole('button', { name: 'Delete draft' }));

		expect(
			within(await screen.findByRole('alertdialog')).getByText('Delete this draft?')
		).toBeDefined();
	});
});
