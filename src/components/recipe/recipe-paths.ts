export const recipeListPath = '/';

export const recipeSearchPath = '/search';

// The list's URL parameters, which search shares.
export const recipeListParamNames = {
	page: 'page',
	sort: 'sort',
} as const;

export function recipePath(slug: string): string {
	return `/recipes/${slug}`;
}

// The Blob store is private, so images reach the browser through the delivery route.
export function recipeImageSrc(pathname: string): string {
	return `/api/images/${pathname}`;
}
