// The first page is the bare list, so its link matches the one in the header.
export function recipeListPath(page: number): string {
	return page === 1 ? '/' : `/?page=${page}`;
}

export function recipePath(slug: string): string {
	return `/recipes/${slug}`;
}

// The Blob store is private, so images reach the browser through the delivery route.
export function recipeImageSrc(pathname: string): string {
	return `/api/images/${pathname}`;
}
