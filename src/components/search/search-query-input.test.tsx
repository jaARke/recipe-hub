import { render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SearchQueryInput } from '@/components/search/search-query-input';

function queryInput(query: string) {
	return <SearchQueryInput aria-label="Search recipes" query={query} />;
}

// The server's field, typed into before the page hydrates.
function hydrateAfterTyping(query: string, typed: string) {
	const container = document.body.appendChild(document.createElement('div'));
	container.innerHTML = renderToString(queryInput(query));
	screen.getByRole<HTMLInputElement>('textbox', { name: 'Search recipes' }).value = typed;
	return render(queryInput(query), { container, hydrate: true });
}

describe('SearchQueryInput', () => {
	it('keeps what was typed before the page hydrated', () => {
		hydrateAfterTyping('', 'sugar');

		expect(screen.getByRole<HTMLInputElement>('textbox').value).toBe('sugar');
	});

	it('takes the query again when the URL’s query changes', () => {
		const { rerender } = hydrateAfterTyping('butter', 'butter and sugar');

		rerender(queryInput('brown butter'));

		expect(screen.getByRole<HTMLInputElement>('textbox').value).toBe('brown butter');
	});
});
