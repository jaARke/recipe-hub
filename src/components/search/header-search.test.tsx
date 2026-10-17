import { beforeEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import { page, userEvent } from 'vitest/browser';
import { holdPageLoads } from '@/components/auth/testing/page-loads';
import { HeaderSearchForm } from '@/components/search/header-search';

// Tailwind's lg breakpoint, from which the header's row holds the field.
const lgViewport = { width: 1024, height: 768 };

const hint = 'Try "brown butter" for an exact phrase, or -nuts to leave nuts out.';

// The header's form, beside the search page's hint, which only the search page has.
async function renderHeaderSearch({ query, searchPage }: { query: string; searchPage: boolean }) {
	await render(
		<>
			<HeaderSearchForm
				formId="header-search"
				queryName="q"
				hintId="search-hint"
				query={query}
				searchPage={searchPage}
			/>
			{searchPage && <p id="search-hint">{hint}</p>}
		</>
	);
}

// What a width hides leaves the accessibility tree, so a hidden control is found with includeHidden.
function searchField({ includeHidden = false } = {}) {
	return page.getByRole('searchbox', { name: 'Search recipes', includeHidden });
}

function searchIcon({ includeHidden = false } = {}) {
	return page.getByRole('button', { name: 'Search recipes', includeHidden });
}

function cancelButton() {
	return page.getByRole('button', { name: 'Cancel' });
}

describe('HeaderSearchForm', () => {
	it('opens the field from the search icon and focuses it in the same tap', async () => {
		await renderHeaderSearch({ query: '', searchPage: false });
		await expect.element(searchField({ includeHidden: true })).not.toBeVisible();

		await searchIcon().click();

		await expect.element(searchField()).toHaveFocus();
		await expect.element(cancelButton()).toBeVisible();
	});

	it('brings the row back on Cancel, keeping the query and focusing the icon', async () => {
		await renderHeaderSearch({ query: 'brown butter', searchPage: true });

		await cancelButton().click();

		await expect.element(searchIcon()).toHaveFocus();
		await expect.element(searchField({ includeHidden: true })).not.toBeVisible();
		await searchIcon().click();
		await expect.element(searchField()).toHaveValue('brown butter');
	});

	it('opens with the field on the search page, described by its hint', async () => {
		await renderHeaderSearch({ query: 'brown butter', searchPage: true });

		await expect.element(searchField()).toHaveAccessibleDescription(hint);
		await expect.element(cancelButton()).toBeVisible();
	});

	describe('from lg', () => {
		beforeEach(async () => {
			await page.viewport(lgViewport.width, lgViewport.height);
		});

		it('starts a fresh search with only its own query elsewhere, from the field the row shows', async () => {
			const loads = holdPageLoads();
			await renderHeaderSearch({ query: '', searchPage: false });
			await expect.element(searchIcon({ includeHidden: true })).not.toBeVisible();

			await searchField().fill('sugar');
			await userEvent.keyboard('{Enter}');

			await expect.poll(() => loads).toEqual([{ path: '/search?q=sugar', type: 'push' }]);
		});
	});
});
