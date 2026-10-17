import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import { hydrate, serverRender } from '@/components/forms/testing/hydrate';
import { renderKeptPage } from '@/components/forms/testing/kept-page';
import { RecipeListHeading } from '@/components/recipe/recipe-list-heading';

// Next's bfcacheId for the page's segment, which back and forward keep.
const router = vi.hoisted(() => ({ bfcacheId: 'first-visit' }));

vi.mock('next/navigation', async (importOriginal) => ({
	...(await importOriginal<typeof import('next/navigation')>()),
	useRouter: () => router,
}));

const heading = <RecipeListHeading id="recipes-heading">Recipes</RecipeListHeading>;

describe('RecipeListHeading', () => {
	it('leaves focus alone when the page arrives from the server', async () => {
		const container = serverRender(heading);

		await hydrate(container, heading);

		expect(document.activeElement).toBe(document.body);
	});

	it('takes the focus that fell with the content it replaced', async () => {
		await render(heading);

		await expect.element(page.getByRole('heading', { name: 'Recipes' })).toHaveFocus();
	});

	// Focusing the heading would scroll it into view, losing the scroll the browser restores.
	it('moves no focus when its kept page shows again on a return through history', async () => {
		const keptPage = await renderKeptPage(heading);
		await keptPage.hide();
		// The browser takes focus from the hidden page's heading.
		await expect.poll(() => document.activeElement).toBe(document.body);

		await keptPage.show();

		expect(document.activeElement).toBe(document.body);
	});
});
