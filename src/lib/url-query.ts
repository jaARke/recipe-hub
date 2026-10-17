// A page's searchParams as Next.js passes them: a repeated parameter arrives as an array.
export type RouteSearchParams = Record<string, string | string[] | undefined>;

// A path with its query, or the path alone when there is none, so a page has one URL without one.
export function hrefWithParams(path: string, params: URLSearchParams): string {
	const query = params.toString();
	return query === '' ? path : `${path}?${query}`;
}
