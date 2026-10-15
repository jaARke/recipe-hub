import { render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderKeptPage } from '@/components/forms/testing/kept-page';
import { RecipeListHeading } from '@/components/recipe/recipe-list-heading';

// Next's bfcacheId for the page's segment, which back and forward keep.
const router = vi.hoisted(() => ({ bfcacheId: 'first-visit' }));

vi.mock('next/navigation', async (importOriginal) => ({
	...(await importOriginal<typeof import('next/navigation')>()),
	useRouter: () => router,
}));

const heading = <RecipeListHeading id="recipes-heading">Recipes</RecipeListHeading>;

function recipesHeading() {
	return screen.getByRole('heading', { name: 'Recipes' });
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe('RecipeListHeading', () => {
	it('leaves focus alone when the page arrives from the server', () => {
		const container = document.body.appendChild(document.createElement('div'));
		container.innerHTML = renderToString(heading);

		render(heading, { container, hydrate: true });

		expect(document.activeElement).toBe(document.body);
	});

	it('takes the focus that fell with the content it replaced', () => {
		render(heading);

		expect(document.activeElement).toBe(recipesHeading());
	});

	// Focusing the heading would scroll it into view, losing the scroll the browser restores.
	it('moves no focus when its kept page shows again on a return through history', async () => {
		const page = renderKeptPage(heading);
		const shown = recipesHeading();
		await page.hide();
		// A browser drops focus from the hidden page's heading.
		shown.blur();
		const focus = vi.spyOn(HTMLElement.prototype, 'focus');

		await page.show();

		expect(focus).not.toHaveBeenCalled();
		expect(document.activeElement).toBe(document.body);
	});
});
