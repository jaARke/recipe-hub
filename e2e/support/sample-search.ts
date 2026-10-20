import { recipeListPath } from '@/components/recipe/recipe-paths';
import { recipeSearchParamNames } from '@/components/search/search-params';
import { hrefWithParams } from '@/lib/url-query';

// A search the seed's soups answer, which the suites load as the Recipes page with results.
export const sampleSearchPath = hrefWithParams(
	recipeListPath,
	new URLSearchParams({ [recipeSearchParamNames.text]: 'soup' })
);
