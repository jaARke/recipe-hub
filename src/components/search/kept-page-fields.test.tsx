import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import { hydrate, serverRender } from '@/components/forms/testing/hydrate';
import { renderKeptPage } from '@/components/forms/testing/kept-page';
import { HeaderSearchForm } from '@/components/search/header-search';
import { HiddenSearchFields } from '@/components/search/hidden-search-fields';
import { KeptPageFields } from '@/components/search/kept-page-fields';
import type { RecipeSearchState } from '@/components/search/search-params';

const state: RecipeSearchState = {
	text: 'butter',
	chapter: 'breads-rolls',
	holidays: [],
	diets: [],
	sort: 'newest',
	page: 1,
};

const searchPageFields = (
	<KeptPageFields>
		<HiddenSearchFields state={state} editedFields={['text']} form="header-search" />
	</KeptPageFields>
);

// The header's own field, then the search page's fields that join its form.
const headerField = ['q', 'sugar'];
const joinedFields = [headerField, ['chapter', 'breads-rolls'], ['sort', 'newest']];

async function renderHeaderForm() {
	await render(
		<HeaderSearchForm
			formId="header-search"
			queryName="q"
			hintId="search-hint"
			query="sugar"
			searchPage
		/>
	);
}

// What the header's form would submit.
function headerFormData() {
	return [...new FormData(document.getElementById('header-search') as HTMLFormElement)];
}

describe('KeptPageFields', () => {
	it('joins the header’s form while its page shows, and leaves it while hidden', async () => {
		await renderHeaderForm();
		const keptPage = await renderKeptPage(searchPageFields);

		expect(headerFormData()).toEqual(joinedFields);
		await keptPage.hide();
		expect(headerFormData()).toEqual([headerField]);
		await keptPage.show();
		expect(headerFormData()).toEqual(joinedFields);
	});

	it('stays out of the header’s form when created on a page that is hidden, until the page shows', async () => {
		await renderHeaderForm();
		const page = (mode: React.ActivityProps['mode']) => (
			<React.Activity mode={mode}>{searchPageFields}</React.Activity>
		);
		const { rerender } = await render(page('hidden'));

		expect(headerFormData()).toEqual([headerField]);
		await rerender(page('visible'));
		expect(headerFormData()).toEqual(joinedFields);
	});

	it('joins the header’s form from the server, so its fields submit before the page hydrates', async () => {
		await renderHeaderForm();
		const container = serverRender(searchPageFields);

		expect(headerFormData()).toEqual(joinedFields);
		await hydrate(container, searchPageFields);
		expect(headerFormData()).toEqual(joinedFields);
	});
});
