import { imageRouteSrc } from '@/lib/image-paths';
import { hrefWithParams } from '@/lib/url-query';

// The Recipes page, where every recipe is browsed and searched.
export const recipeListPath = '/';

// The Recipes page's heading for every recipe, in title case as every h1 is, and the link back to it.
export const allRecipesTitle = 'All Recipes';
export const backToAllRecipesLabel = `Back to ${allRecipesTitle}`;

export const contributePath = '/contribute';

export const favoritesPath = '/favorites';

// What the Recipes page at a query would count, which its filter sheet reads before applying.
export const recipeCountsPath = '/api/recipe-counts';

// Each recipe's page sits below it.
export const recipePagesPath = '/recipes';

// The list's URL parameters, which search shares.
export const recipeListParamNames = {
	page: 'page',
	sort: 'sort',
} as const;

export function recipePath(slug: string): string {
	return `${recipePagesPath}/${slug}`;
}

// The recipe page's parameter saying the member has just added the recipe, which the page says once.
export const recipeAddedParamName = 'added';

// The recipe's page as adding the recipe lands on it.
export function addedRecipePath(slug: string): string {
	return hrefWithParams(recipePath(slug), new URLSearchParams({ [recipeAddedParamName]: '1' }));
}

export function recipeEditPath(slug: string): string {
	return `${recipePath(slug)}/edit`;
}

// The recipe's full-screen cooking view.
export function recipeCookPath(slug: string): string {
	return `${recipePath(slug)}/cook`;
}

// The Blob store is private, so images reach the browser through the delivery route.
export function recipeImageSrc(pathname: string): string {
	return imageRouteSrc(pathname);
}
