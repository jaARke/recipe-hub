import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FormAction } from '@/components/forms/form-state';
import { DeleteRecipeDialog } from '@/components/recipe-form/delete-recipe-dialog';

const router = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock('next/navigation', async (importOriginal) => ({
	...(await importOriginal<typeof import('next/navigation')>()),
	useRouter: () => router,
}));

const recipeId = '0b6f3c7e-3c1a-4d8e-9a57-2f1d6b8e4c10';
const recipeKey = `member:recipe-form:recipe:${recipeId}`;
const otherKeys = [
	'member:recipe-form:recipe:9a1e4c2b-7d3f-4e8a-b5c6-1f2d3e4a5b6c',
	'member:recipe-form:new',
];

const succeed: FormAction = async () => ({ status: 'success' });

async function deleteRecipe(action: FormAction) {
	const user = userEvent.setup();
	render(<DeleteRecipeDialog recipeId={recipeId} title="Lemon bars" action={action} />);
	await user.click(screen.getByRole('button', { name: 'Delete recipe' }));
	await user.click(
		within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete recipe' })
	);
}

afterEach(() => {
	vi.clearAllMocks();
	localStorage.clear();
});

describe('DeleteRecipeDialog', () => {
	it('removes the recipe’s unsaved changes, and no others, before it leaves for the list', async () => {
		for (const key of [recipeKey, ...otherKeys]) {
			localStorage.setItem(key, '{}');
		}
		let entryAsItLeft: string | null | undefined;
		router.replace.mockImplementation(() => {
			entryAsItLeft = localStorage.getItem(recipeKey);
		});

		await deleteRecipe(succeed);

		await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
		expect(entryAsItLeft).toBeNull();
		expect(otherKeys.map((key) => localStorage.getItem(key))).toEqual(['{}', '{}']);
	});

	it('keeps the recipe’s unsaved changes when the delete is refused', async () => {
		localStorage.setItem(recipeKey, '{}');

		await deleteRecipe(async () => ({
			status: 'error',
			message: 'We couldn’t delete the recipe. Reload the page and try again.',
			fieldErrors: {},
		}));

		expect(
			await screen.findByText('We couldn’t delete the recipe. Reload the page and try again.')
		).toBeDefined();
		expect(router.replace).not.toHaveBeenCalled();
		expect(localStorage.getItem(recipeKey)).toBe('{}');
	});
});
