import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import { RecipeSearchToolbar } from '@/components/search/recipe-search-toolbar';

// The results heading and a stand-in filters form; the real form navigates through Next's router.
async function renderToolbar() {
	await render(
		<section>
			<h2 id="results-heading" tabIndex={-1}>
				Results
			</h2>
			<RecipeSearchToolbar
				appliedFilterCount={2}
				resultsHeadingId="results-heading"
				count={<p>12 recipes</p>}
				sort={
					<form aria-label="Order" onSubmit={(event) => event.preventDefault()}>
						<button type="submit">Sort</button>
					</form>
				}
				filters={
					<form aria-label="Filters" onSubmit={(event) => event.preventDefault()}>
						<label>
							<input type="checkbox" name="tag" value="Baking" /> Baking
						</label>
						<button type="submit">Apply filters</button>
					</form>
				}
			/>
		</section>
	);
}

// Shown below lg, which the default viewport is.
function filtersButton() {
	return page.getByRole('button', { name: /^Filters/ });
}

function filtersForm() {
	return page.getByRole('form', { name: 'Filters' });
}

describe('RecipeSearchToolbar', () => {
	it('opens the filters beneath it, above the count, from the Filters button with the applied count', async () => {
		await renderToolbar();
		await expect.element(filtersButton()).toHaveAccessibleName('Filters 2 applied');
		await expect.element(filtersForm()).not.toBeInTheDocument();

		await filtersButton().click();

		await expect.element(filtersButton()).toHaveAttribute('aria-expanded', 'true');
		await expect.element(filtersForm()).toBeVisible();
		const button = filtersButton().element().getBoundingClientRect();
		const filters = filtersForm().element().getBoundingClientRect();
		const count = page.getByText('12 recipes').element().getBoundingClientRect();
		expect(filters.top).toBeGreaterThanOrEqual(button.bottom);
		expect(count.top).toBeGreaterThanOrEqual(filters.bottom);
	});

	it('closes the filters and moves focus to the results when they apply', async () => {
		await renderToolbar();
		await filtersButton().click();

		await page.getByRole('button', { name: 'Apply filters' }).click();

		await expect.element(page.getByRole('heading', { name: 'Results' })).toHaveFocus();
		await expect.element(filtersForm()).not.toBeInTheDocument();
		await expect.element(filtersButton()).toHaveAttribute('aria-expanded', 'false');
	});

	it('keeps a filter chosen but not applied when the panel closes and opens again', async () => {
		await renderToolbar();
		await filtersButton().click();
		await page.getByRole('checkbox', { name: 'Baking' }).click();

		await filtersButton().click();
		await expect.element(filtersForm()).not.toBeInTheDocument();
		await filtersButton().click();

		await expect.element(page.getByRole('checkbox', { name: 'Baking' })).toBeChecked();
	});

	it('leaves the filters open and focus where it was when the order changes', async () => {
		await renderToolbar();
		await filtersButton().click();

		await page.getByRole('button', { name: 'Sort' }).click();

		// WebKit, as Safari does, focuses no button it clicks, so only the heading is ruled out.
		expect(document.activeElement).not.toBe(
			page.getByRole('heading', { name: 'Results' }).element()
		);
		await expect.element(filtersForm()).toBeVisible();
	});
});
