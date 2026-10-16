import { render, screen } from '@testing-library/react';
import Link from 'next/link';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderKeptPage } from '@/components/forms/testing/kept-page';
import { favoriteListHref } from '@/components/recipe/recipe-list-params';
import { RecipePagination } from '@/components/recipe/recipe-pagination';

// A list page's heading, a recipe's card, and the pagination, at the given page of three.
function listPage(page: number) {
	return (
		<>
			<h1 id="favorites-heading" tabIndex={-1}>
				Favorites
			</h1>
			<Link href="/recipes/lemon-bars">Lemon bars</Link>
			<RecipePagination
				page={page}
				pageCount={3}
				pageHref={favoriteListHref}
				resultsHeadingId="favorites-heading"
			/>
		</>
	);
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe('RecipePagination', () => {
	it('moves focus to the results heading when a link here changes the page', () => {
		const { rerender } = render(listPage(1));
		screen.getByRole('link', { name: 'Page 2' }).focus();

		rerender(listPage(2));

		expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Favorites' }));
	});

	// Focusing the heading would scroll it into view, losing the scroll the browser restores.
	it('moves no focus when its page shows again, as on a return through history', async () => {
		const page = renderKeptPage(listPage(2));
		const card = screen.getByRole('link', { name: 'Lemon bars' });
		card.focus();
		await page.hide();
		// A browser drops focus from the hidden page's card.
		card.blur();
		const focus = vi.spyOn(HTMLElement.prototype, 'focus');

		await page.show();

		expect(focus).not.toHaveBeenCalled();
		expect(document.activeElement).toBe(document.body);
	});
});
