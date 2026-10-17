import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { page, type Locator } from 'vitest/browser';
import { FavoriteToggle } from '@/components/favorites/favorite-toggle';
import type { FormState } from '@/components/forms/form-state';
import { heldResult } from '@/components/forms/testing/held-result';
import { toast } from '@/components/ui/toast';

const recipeId = '0199c7a4-6b1e-7a3c-9d2f-1a2b3c4d5e6f';

// An action that answers only when the test says so, or as the test ends.
function heldAction() {
	const { promise, resolve } = heldResult<FormState>({ status: 'success' });
	const action = vi.fn<(recipeId: string, favorite: boolean) => Promise<FormState>>(() => promise);
	return { action, answer: resolve };
}

// The toggle, named by its label whether pressed or not.
function favoriteButton(pressed?: boolean): Locator {
	return page.getByRole('button', { name: 'Favorite', pressed });
}

// How the toggle's heart is filled, which shows a favorite to the eye as aria-pressed does to a
// screen reader.
function heartFill(): string {
	const heart = favoriteButton().element().querySelector('svg');
	return heart === null ? '' : getComputedStyle(heart).fill;
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe('FavoriteToggle', () => {
	it('keeps its label as its name whether pressed or not, which aria-pressed and its heart tell apart', async () => {
		const { action } = heldAction();
		await render(
			<FavoriteToggle recipeId={recipeId} favorite={false} setFavoriteAction={action} />
		);
		await expect.element(favoriteButton(false)).toHaveTextContent('Favorite');
		expect(heartFill()).toBe('none');

		await favoriteButton().click();

		await expect.element(favoriteButton(true)).toHaveTextContent('Favorite');
		expect(heartFill()).not.toBe('none');
	});

	it('shows a favorite at once and keeps it once the page renders it saved', async () => {
		const { action, answer } = heldAction();
		const { rerender } = await render(
			<FavoriteToggle recipeId={recipeId} favorite={false} setFavoriteAction={action} />
		);

		await favoriteButton().click();

		await expect.element(favoriteButton(true)).toBeVisible();
		expect(action).toHaveBeenCalledWith(recipeId, true);

		// Answered as the page renders it saved, a render that returns once the toggle has settled.
		answer({ status: 'success' });
		await rerender(<FavoriteToggle recipeId={recipeId} favorite setFavoriteAction={action} />);

		await expect.element(favoriteButton(true)).toBeVisible();
	});

	it('goes back and says why in a toast when the change is refused', async () => {
		const add = vi.spyOn(toast, 'add');
		const { action, answer } = heldAction();
		await render(
			<FavoriteToggle recipeId={recipeId} favorite={false} setFavoriteAction={action} />
		);

		await favoriteButton().click();
		await expect.element(favoriteButton(true)).toBeVisible();
		answer({
			status: 'error',
			message: 'You’ve reached the limit of 100 favorites on this device.',
			fieldErrors: {},
		});

		await expect.element(favoriteButton(false)).toBeVisible();
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
		await render(<FavoriteToggle recipeId={recipeId} favorite setFavoriteAction={fail} />);

		await favoriteButton().click();

		await expect
			.poll(() => add)
			.toHaveBeenCalledWith({
				type: 'error',
				title: 'Couldn’t remove this favorite',
				description: 'Check your connection and try again.',
			});
		await expect.element(favoriteButton(true)).toBeVisible();
		expect(fail).toHaveBeenCalledWith(recipeId, false);
	});
});
