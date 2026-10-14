import { render } from '@testing-library/react';
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { renderKeptPage } from '@/components/forms/testing/kept-page';
import { HeaderSearchForm } from '@/components/search/header-search';
import { HiddenSearchFields } from '@/components/search/hidden-search-fields';
import { KeptPageFields } from '@/components/search/kept-page-fields';
import type { RecipeSearchState } from '@/components/search/search-params';

const state: RecipeSearchState = { text: 'butter', tags: ['Baking'], sort: 'newest', page: 1 };

const searchPageFields = (
	<KeptPageFields>
		<HiddenSearchFields state={state} editedFields={['text']} form="header-search" />
	</KeptPageFields>
);

function fieldset() {
	return document.querySelector('fieldset');
}

// happy-dom still submits a disabled fieldset's fields, which browsers leave out, so past the shown
// page's FormData these assert the fieldset's disabled state.
describe('KeptPageFields', () => {
	it('joins the header’s form while its page shows, and is disabled while hidden', async () => {
		render(
			<HeaderSearchForm
				formId="header-search"
				queryName="q"
				hintId="search-hint"
				query="sugar"
				searchPage
			/>
		);
		const page = renderKeptPage(searchPageFields);
		const headerForm = document.getElementById('header-search') as HTMLFormElement;

		expect([...new FormData(headerForm)]).toEqual([
			['q', 'sugar'],
			['tag', 'Baking'],
			['sort', 'newest'],
		]);
		expect(fieldset()?.disabled).toBe(false);
		await page.hide();
		expect(fieldset()?.disabled).toBe(true);
		await page.show();
		expect(fieldset()?.disabled).toBe(false);
	});

	it('starts disabled when created on a page that is hidden, until the page shows', () => {
		const page = (mode: React.ActivityProps['mode']) => (
			<React.Activity mode={mode}>{searchPageFields}</React.Activity>
		);
		const { rerender } = render(page('hidden'));

		expect(fieldset()?.disabled).toBe(true);
		rerender(page('visible'));
		expect(fieldset()?.disabled).toBe(false);
	});

	it('starts enabled from the server, so its fields submit before the page hydrates', () => {
		const container = document.body.appendChild(document.createElement('div'));
		container.innerHTML = renderToString(searchPageFields);

		expect(fieldset()?.disabled).toBe(false);
		render(searchPageFields, { container, hydrate: true });
		expect(fieldset()?.disabled).toBe(false);
	});
});
