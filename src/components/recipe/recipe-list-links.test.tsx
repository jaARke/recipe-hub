import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Link from 'next/link';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RecipeListLinks } from '@/components/recipe/recipe-list-links';
import { readTabStorage } from '@/lib/browser-storage';

const listUrl = `${location.origin}/search?q=chicken&tags=dinner&sort=title&page=2`;

const recipeKey = 'opened-from:/recipes/lemon-bars';

// The test's page stays put. Prevented before the link sees the click, since happy-dom follows a link
// as the click passes it, before its ancestors hear it, and Link then leaves the click alone.
function stayOnPage(event: MouseEvent) {
	event.preventDefault();
}

function renderList() {
	render(
		<RecipeListLinks>
			<ul>
				<li>
					<Link href="/recipes/lemon-bars">
						<h3>Lemon bars</h3>
					</Link>
				</li>
				<li>
					<Link href="/search?tag=dessert">dessert</Link>
				</li>
			</ul>
		</RecipeListLinks>
	);
}

beforeEach(() => {
	history.replaceState(null, '', listUrl);
	document.addEventListener('click', stayOnPage, { capture: true });
});

afterEach(() => {
	document.removeEventListener('click', stayOnPage, { capture: true });
	sessionStorage.clear();
});

describe('RecipeListLinks', () => {
	it("records the list's page, its query whole, as where a recipe was opened from", async () => {
		renderList();

		await userEvent.click(screen.getByRole('heading', { name: 'Lemon bars' }));

		expect(readTabStorage(recipeKey)).toBe(listUrl);
	});

	it('records nothing for a click that opens the recipe in another tab or window', () => {
		renderList();
		const link = screen.getByRole('link', { name: 'Lemon bars' });

		for (const keys of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }]) {
			fireEvent.click(link, keys);
		}

		expect(readTabStorage(recipeKey)).toBeUndefined();
	});

	it('records nothing for a link to another kind of page', async () => {
		renderList();

		await userEvent.click(screen.getByRole('link', { name: 'dessert' }));

		expect(sessionStorage.length).toBe(0);
	});
});
