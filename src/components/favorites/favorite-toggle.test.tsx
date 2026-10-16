import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FavoriteToggle } from '@/components/favorites/favorite-toggle';
import type { FormState } from '@/components/forms/form-state';
import { toast } from '@/components/ui/toast';

const recipeId = '0199c7a4-6b1e-7a3c-9d2f-1a2b3c4d5e6f';

// An action that answers only when the test says so.
function heldAction() {
	let answer: (result: FormState) => void = () => {};
	const action = vi.fn<(recipeId: string, favorite: boolean) => Promise<FormState>>(
		() =>
			new Promise((resolve) => {
				answer = resolve;
			})
	);
	// Waits for the transition the answer ends, so what shows after it is what the toggle settled on.
	return { action, answer: (result: FormState) => act(async () => answer(result)) };
}

function favoriteButton(): HTMLElement {
	return screen.getByRole('button', { name: 'Favorite' });
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe('FavoriteToggle', () => {
	it('keeps its label as its name whether pressed or not, which aria-pressed tells apart', async () => {
		const { action, answer } = heldAction();
		const user = userEvent.setup();
		render(<FavoriteToggle recipeId={recipeId} favorite={false} setFavoriteAction={action} />);

		expect(favoriteButton().getAttribute('aria-pressed')).toBe('false');
		expect(favoriteButton().textContent).toBe('Favorite');

		await user.click(favoriteButton());

		expect(favoriteButton().getAttribute('aria-pressed')).toBe('true');
		expect(favoriteButton().textContent).toBe('Favorite');
		await answer({ status: 'success' });
	});

	it('shows a favorite at once and keeps it once the page renders it saved', async () => {
		const { action, answer } = heldAction();
		const user = userEvent.setup();
		const { rerender } = render(
			<FavoriteToggle recipeId={recipeId} favorite={false} setFavoriteAction={action} />
		);

		await user.click(favoriteButton());

		expect(favoriteButton().getAttribute('aria-pressed')).toBe('true');
		expect(action).toHaveBeenCalledWith(recipeId, true);

		rerender(<FavoriteToggle recipeId={recipeId} favorite setFavoriteAction={action} />);
		await answer({ status: 'success' });

		expect(favoriteButton().getAttribute('aria-pressed')).toBe('true');
	});

	it('goes back and says why in a toast when the change is refused', async () => {
		const add = vi.spyOn(toast, 'add');
		const { action, answer } = heldAction();
		const user = userEvent.setup();
		render(<FavoriteToggle recipeId={recipeId} favorite={false} setFavoriteAction={action} />);

		await user.click(favoriteButton());
		await answer({
			status: 'error',
			message: 'You’ve reached the limit of 100 favorites on this device.',
			fieldErrors: {},
		});

		expect(favoriteButton().getAttribute('aria-pressed')).toBe('false');
		expect(add).toHaveBeenCalledWith({
			type: 'error',
			title: 'Couldn’t add this favorite',
			description: 'You’ve reached the limit of 100 favorites on this device.',
		});
	});

	it('goes back and asks to check the connection when the request fails', async () => {
		const add = vi.spyOn(toast, 'add');
		const fail = vi.fn(async () => {
			throw new TypeError('Failed to fetch');
		});
		const user = userEvent.setup();
		render(<FavoriteToggle recipeId={recipeId} favorite setFavoriteAction={fail} />);

		await user.click(favoriteButton());
		await act(async () => {});

		expect(favoriteButton().getAttribute('aria-pressed')).toBe('true');
		expect(fail).toHaveBeenCalledWith(recipeId, false);
		expect(add).toHaveBeenCalledWith({
			type: 'error',
			title: 'Couldn’t remove this favorite',
			description: 'Check your connection and try again.',
		});
	});
});
