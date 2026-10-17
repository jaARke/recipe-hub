import { recipeSearchPath } from '@/components/recipe/recipe-paths';
import { recipeSearchParamNames } from '@/components/search/search-params';
import { hrefWithParams } from '@/lib/url-query';

// A search the seed's soups answer, which the suites load as the search page with results. A search
// without words is Browse, so it has words.
export const sampleSearchPath = hrefWithParams(
	recipeSearchPath,
	new URLSearchParams({ [recipeSearchParamNames.text]: 'soup' })
);
