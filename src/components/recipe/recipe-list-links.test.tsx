import Link from 'next/link';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import { holdPageLoads } from '@/components/auth/testing/page-loads';
import { RecipeListLinks } from '@/components/recipe/recipe-list-links';
import { readTabStorage } from '@/lib/browser-storage';

const listUrl = `${location.origin}/search?q=chicken&tags=dinner&sort=title&page=2`;

const recipeKey = 'opened-from:/recipes/lemon-bars';

async function renderList() {
	await render(
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
	// A followed link loads its page, which would replace the test's.
	holdPageLoads();
});

afterEach(() => {
	sessionStorage.clear();
});

describe('RecipeListLinks', () => {
	it("records the list's page, its query whole, as where a recipe was opened from", async () => {
		await renderList();

		await page.getByRole('heading', { name: 'Lemon bars' }).click();

		expect(readTabStorage(recipeKey)).toBe(listUrl);
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
