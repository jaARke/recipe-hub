import { Suspense } from 'react';
import { HeaderSearch, HeaderSearchForm } from '@/components/search/header-search';
import { HiddenSearchFields } from '@/components/search/hidden-search-fields';
import { KeptPageFields } from '@/components/search/kept-page-fields';
import {
	recipeSearchMode,
	recipeSearchParamNames,
	type RecipeSearchField,
	type RecipeSearchMode,
	type RecipeSearchState,
} from '@/components/search/search-params';

// The site header's search form, which Browse's and Search's hidden fields join from outside it.
const headerSearchFormId = 'header-search';

// What a new query typed in the header leaves of the page's search: the words, and on Browse the
// order too, since words typed there take Best match.
const headerEditedFields: Record<RecipeSearchMode, readonly RecipeSearchField[]> = {
	browse: ['text', 'sort'],
	search: ['text'],
};

// The search page's hint, which describes the header's field from outside it.
const recipeSearchHintId = 'search-hint';

// Until the URL is read, the empty field holds its place.
function HeaderSearchBar({ formId }: { formId: string }) {
	const props = { formId, queryName: recipeSearchParamNames.text, hintId: recipeSearchHintId };

	return (
		<Suspense fallback={<HeaderSearchForm {...props} query="" searchPage={false} />}>
			<HeaderSearch {...props} />
		</Suspense>
	);
}

// The page's search, joined to the header's form from the page, so a new query keeps its filters.
function HeaderSearchFields({ state }: { state: RecipeSearchState }) {
	return (
		<KeptPageFields>
			<HiddenSearchFields
				state={state}
				editedFields={headerEditedFields[recipeSearchMode(state)]}
				form={headerSearchFormId}
			/>
		</KeptPageFields>
	);
}

export { HeaderSearchBar, HeaderSearchFields, headerSearchFormId, recipeSearchHintId };
