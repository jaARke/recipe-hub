import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { RecipeSearchToolbar } from '@/components/search/recipe-search-toolbar';

// The results heading and a stand-in filters form; the real form navigates through Next's router.
function renderToolbar() {
	render(
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
	return screen.getByRole('button', { name: /^Filters/ });
}

describe('RecipeSearchToolbar', () => {
	it('opens the filters beneath it from the Filters button, with the applied count', async () => {
		const trigger = renderToolbar();

		expect(trigger.textContent).toContain('2 applied');
		expect(screen.queryByRole('form', { name: 'Filters' })).toBeNull();
		await userEvent.click(trigger);

		expect(trigger.getAttribute('aria-expanded')).toBe('true');
		expect(screen.getByRole('form', { name: 'Filters' })).toBeTruthy();
	});

	it('closes the filters and moves focus to the results when they apply', async () => {
		const trigger = renderToolbar();
		await userEvent.click(trigger);

		await userEvent.click(screen.getByRole('button', { name: 'Apply filters' }));

		expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Results' }));
		await waitFor(() => expect(screen.queryByRole('form', { name: 'Filters' })).toBeNull());
		expect(trigger.getAttribute('aria-expanded')).toBe('false');
	});

	it('keeps a filter chosen but not applied when the panel closes and opens again', async () => {
		const trigger = renderToolbar();
		await userEvent.click(trigger);
		await userEvent.click(screen.getByRole('checkbox', { name: 'Baking' }));

		await userEvent.click(trigger);
		await waitFor(() => expect(screen.queryByRole('checkbox', { name: 'Baking' })).toBeNull());
		await userEvent.click(trigger);

		expect(screen.getByRole<HTMLInputElement>('checkbox', { name: 'Baking' }).checked).toBe(true);
	});

	it('leaves the filters open and focus in place when the order changes', async () => {
		const trigger = renderToolbar();
		await userEvent.click(trigger);

		const sort = screen.getByRole('button', { name: 'Sort' });
		await userEvent.click(sort);

		expect(document.activeElement).toBe(sort);
		expect(screen.getByRole('form', { name: 'Filters' })).toBeTruthy();
	});
});
