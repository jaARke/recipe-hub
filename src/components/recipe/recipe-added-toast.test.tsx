import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { RecipeAddedToast } from '@/components/recipe/recipe-added-toast';
import { toast } from '@/components/ui/toast';

const added = {
	type: 'success',
	title: 'Added to the cookbook',
	description: 'Everyone in the family can see it now.',
};

afterEach(() => {
	vi.restoreAllMocks();
	window.history.replaceState(null, '', '/');
});

describe('RecipeAddedToast', () => {
	// Strict Mode runs effects twice, as the dev server does.
	it('says the recipe was added, once, and makes the address the recipe’s own', async () => {
		const add = vi.spyOn(toast, 'add');
		window.history.replaceState(null, '', '/recipes/lemon-bars?added=1#ingredients');

		await render(
			<StrictMode>
				<RecipeAddedToast />
			</StrictMode>
		);

		await expect.poll(() => add).toHaveBeenCalledWith(added);
		expect(add).toHaveBeenCalledOnce();
		expect(`${location.pathname}${location.search}${location.hash}`).toBe(
			'/recipes/lemon-bars#ingredients'
		);
	});

	it('says nothing again as the page loads from the address it left', async () => {
		const add = vi.spyOn(toast, 'add');
		window.history.replaceState(null, '', '/recipes/lemon-bars?added=1');
		const first = await render(<RecipeAddedToast />);
		await expect.poll(() => add).toHaveBeenCalledOnce();
		await first.unmount();

		await render(<RecipeAddedToast />);

		await new Promise((resolve) => setTimeout(resolve));
		expect(add).toHaveBeenCalledOnce();
	});

	it('says nothing on a recipe reached any other way, and leaves its address as it is', async () => {
		const add = vi.spyOn(toast, 'add');
		window.history.replaceState(null, '', '/recipes/lemon-bars?servings=8');

		await render(<RecipeAddedToast />);

		await new Promise((resolve) => setTimeout(resolve));
		expect(add).not.toHaveBeenCalled();
		expect(`${location.pathname}${location.search}`).toBe('/recipes/lemon-bars?servings=8');
	});
});
