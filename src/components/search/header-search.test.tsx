import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { HeaderSearchForm } from '@/components/search/header-search';

function renderHeaderSearch({ query, searchPage }: { query: string; searchPage: boolean }) {
	render(
		<HeaderSearchForm
			formId="header-search"
			queryName="q"
			hintId="search-hint"
			query={query}
			searchPage={searchPage}
		/>
	);
}

describe('HeaderSearchForm', () => {
	it('opens the field from the search icon and focuses it in the same tap', async () => {
		renderHeaderSearch({ query: '', searchPage: false });

		await userEvent.click(screen.getByRole('button', { name: 'Search recipes' }));

		expect(document.activeElement).toBe(screen.getByRole('searchbox', { name: 'Search recipes' }));
		expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
	});

	it('brings the row back on Cancel, keeping the query and focusing the icon', async () => {
		renderHeaderSearch({ query: 'brown butter', searchPage: true });

		await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

		expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Search recipes' }));
		const field = screen.getByLabelText<HTMLInputElement>('Search recipes', { selector: 'input' });
		expect(field.value).toBe('brown butter');
	});

	it('opens with the field on the search page, described by its hint', () => {
		renderHeaderSearch({ query: 'brown butter', searchPage: true });

		expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
		expect(screen.getByRole('searchbox').getAttribute('aria-describedby')).toBe('search-hint');
	});

	it('starts a fresh search with only its own query elsewhere', () => {
		renderHeaderSearch({ query: '', searchPage: false });

		const form = screen.getByRole('searchbox').closest('form');
		expect(form?.getAttribute('action')).toBe('/search');
		expect(form?.id).toBe('header-search');
		expect(screen.getByRole('searchbox').getAttribute('aria-describedby')).toBeNull();
		expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
	});
});
