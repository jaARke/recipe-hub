import Link from 'next/link';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import { holdPageLoads } from '@/components/auth/testing/page-loads';
import { renderKeptPage } from '@/components/forms/testing/kept-page';
import { favoriteListHref } from '@/components/recipe/recipe-list-params';
import { RecipePagination } from '@/components/recipe/recipe-pagination';

// A list page's heading, a recipe's card, and the pagination, at the given page of three.
function listPage(pageNumber: number) {
	return (
		<>
			<h1 id="favorites-heading" tabIndex={-1}>
				Favorites
			</h1>
			<Link href="/recipes/lemon-bars">Lemon bars</Link>
			<RecipePagination
				page={pageNumber}
				pageCount={3}
				pageHref={favoriteListHref}
				resultsHeadingId="favorites-heading"
			/>
		</>
	);
}

describe('RecipePagination', () => {
	it('moves focus to the results heading when a link here changes the page', async () => {
		// The link loads its page, which would replace the test's; the rerender stands in for Next's.
		holdPageLoads();
		const { rerender } = await render(listPage(1));
		await page.getByRole('link', { name: 'Page 2' }).click();

		await rerender(listPage(2));

		await expect.element(page.getByRole('heading', { name: 'Favorites' })).toHaveFocus();
	});

	// Focusing the heading would scroll it into view, losing the scroll the browser restores.
	it('moves no focus when its page shows again, as on a return through history', async () => {
		const keptPage = await renderKeptPage(listPage(2));
		page.getByRole('link', { name: 'Lemon bars' }).element().focus();
		await keptPage.hide();
		// The browser takes focus from the hidden page's card.
		await expect.poll(() => document.activeElement).toBe(document.body);

		await keptPage.show();

		expect(document.activeElement).toBe(document.body);
	});
});
