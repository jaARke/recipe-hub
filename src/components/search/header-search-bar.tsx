import { Suspense } from 'react';
import { HeaderSearch, HeaderSearchForm } from '@/components/search/header-search';
import { recipeSearchHintId } from '@/components/search/recipe-search';
import { recipeSearchParamNames } from '@/components/search/search-params';

// The site header's search form, which the search page's hidden fields join from outside it.
const headerSearchFormId = 'header-search';

// Until the URL is read, the empty field holds its place.
function HeaderSearchBar({ formId }: { formId: string }) {
	const props = { formId, queryName: recipeSearchParamNames.text, hintId: recipeSearchHintId };

	return (
		<Suspense fallback={<HeaderSearchForm {...props} query="" searchPage={false} />}>
			<HeaderSearch {...props} />
		</Suspense>
	);
}

export { HeaderSearchBar, headerSearchFormId };
