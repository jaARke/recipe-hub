import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import { ProblemSummary } from '@/components/forms/problem-summary';

describe('ProblemSummary', () => {
	it('counts the problems and says what fixing them is for', async () => {
		await render(
			<ProblemSummary
				problems={[
					{ message: 'Enter a title.', label: 'Title', targetId: 'title' },
					{ message: 'Add at least one step.', label: 'Steps', targetId: 'steps' },
					{ message: 'Choose a chapter.', label: 'Chapter', targetId: 'chapter' },
				]}
				purpose="before adding it to the cookbook"
			/>
		);

		await expect
			.element(
				page
					.getByRole('alert')
					.getByText('Fix 3 things before adding it to the cookbook', { exact: true })
			)
			.toBeVisible();
	});

	it('counts one problem as one thing', async () => {
		await render(<ProblemSummary problems={[{ message: 'Enter a title.' }]} purpose="to save" />);

		await expect
			.element(page.getByRole('alert').getByText('Fix 1 thing to save', { exact: true }))
			.toBeVisible();
	});

	it('links each problem to where it shows, and moves focus there', async () => {
		await render(
			<>
				<ProblemSummary
					problems={[{ message: 'Enter a title.', label: 'Title', targetId: 'title' }]}
					purpose="to save"
				/>
				<input id="title" aria-label="Title" />
			</>
		);

		await page.getByRole('link', { name: 'Title: Enter a title.' }).click();

		await expect.element(page.getByRole('textbox', { name: 'Title' })).toHaveFocus();
	});

	it('shows nothing while there are no problems', async () => {
		await render(<ProblemSummary problems={[]} purpose="to save" />);

		await expect.element(page.getByRole('alert')).not.toBeInTheDocument();
	});
});
