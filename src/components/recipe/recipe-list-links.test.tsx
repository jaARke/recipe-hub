import Link from 'next/link';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import { RecipeListLinks } from '@/components/recipe/recipe-list-links';
import { readRecipeOpenedFrom } from '@/components/recipe/recipe-opened-from';
import { readTabStorage } from '@/lib/browser-storage';

const listUrl = `${location.origin}/search?q=chicken&tags=dinner&sort=title&page=2`;

const recipeKey = 'opened-from:/recipes/lemon-bars';

// A followed link would load its page in place of the test's, so its click is cancelled once the list
// has seen it: Firefox and WebKit start the load a task later, when the test may be over and no
// longer holding loads.
async function renderList() {
	await render(
		<div onClick={(event) => event.preventDefault()}>
			<RecipeListLinks backLabel="Back to search results">
				<ul role="list">
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
		</div>
	);
}

beforeEach(() => {
	history.replaceState(null, '', listUrl);
});

afterEach(() => {
	sessionStorage.clear();
});

describe('RecipeListLinks', () => {
	it("records the list's page, its query whole, and its back label as where a recipe was opened from", async () => {
		await renderList();

		await page.getByRole('heading', { name: 'Lemon bars' }).click();

		expect(readRecipeOpenedFrom(readTabStorage(recipeKey))).toEqual({
			url: listUrl,
			backLabel: 'Back to search results',
			listPathname: '/search',
		});
	});

	it('records nothing for a click that opens the recipe in another tab or window', async () => {
		await renderList();
		const link = page.getByRole('link', { name: 'Lemon bars' });

		for (const modifier of ['Control', 'Meta', 'Shift'] as const) {
			await link.click({ modifiers: [modifier] });
		}

		expect(readTabStorage(recipeKey)).toBeUndefined();
	});

	it('records nothing for a link to another kind of page', async () => {
		await renderList();

		await page.getByRole('link', { name: 'dessert' }).click();

		expect(sessionStorage.length).toBe(0);
	});
});
