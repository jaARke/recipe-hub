import { HeaderSearch } from '@/components/search/header-search';
import { recipesPageIds } from '@/components/search/recipe-search';
import { recipeSearchParamNames } from '@/components/search/search-params';

// The site header's search, given the words' parameter and the Recipes page's heading from the server.
function HeaderSearchBar({ idPrefix }: { idPrefix: string }) {
	return (
		<HeaderSearch
			idPrefix={idPrefix}
			queryName={recipeSearchParamNames.text}
			resultsHeadingId={recipesPageIds.heading}
		/>
	);
}

export { HeaderSearchBar };
