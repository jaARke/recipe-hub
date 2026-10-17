import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import { hydrate, serverRender } from '@/components/forms/testing/hydrate';
import { SearchQueryInput } from '@/components/search/search-query-input';

function queryInput(query: string) {
	return <SearchQueryInput aria-label="Search recipes" query={query} />;
}

function queryField() {
	return page.getByRole('textbox', { name: 'Search recipes' });
}

describe('SearchQueryInput', () => {
	it('keeps what was typed before the page hydrated', async () => {
		const container = serverRender(queryInput(''));
		await queryField().fill('sugar');

		await hydrate(container, queryInput(''));

		await expect.element(queryField()).toHaveValue('sugar');
	});

	it('takes the query again when the URL’s query changes', async () => {
		const { rerender } = await render(queryInput('butter'));
		await queryField().fill('butter and sugar');

		await rerender(queryInput('brown butter'));

		await expect.element(queryField()).toHaveValue('brown butter');
	});
});
