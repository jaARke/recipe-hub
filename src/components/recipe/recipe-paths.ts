import { imageRouteSrc } from '@/lib/image-paths';

export const recipeListPath = '/';

export const recipeSearchPath = '/search';

export const contributePath = '/contribute';

export const favoritesPath = '/favorites';

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
