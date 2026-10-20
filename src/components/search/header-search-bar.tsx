import { HeaderSearch } from '@/components/search/header-search';
import { recipeSearchParamNames } from '@/components/search/search-params';

// The site header's search, given the words' parameter from the server.
function HeaderSearchBar({ idPrefix }: { idPrefix: string }) {
	return <HeaderSearch idPrefix={idPrefix} queryName={recipeSearchParamNames.text} />;
}

export { HeaderSearchBar };
