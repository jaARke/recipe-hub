// A page's searchParams as Next.js passes them: a repeated parameter arrives as an array.
export type RouteSearchParams = Record<string, string | string[] | undefined>;

// A path with its query, or the path alone when there is none, so a page has one URL without one.
export function hrefWithParams(path: string, params: URLSearchParams): string {
	const query = params.toString();
	return query === '' ? path : `${path}?${query}`;
}

// A URL's query as Next.js passes it to a page, for code that reads a request before the page does.
export function routeSearchParams(params: URLSearchParams): RouteSearchParams {
	const routeParams: RouteSearchParams = {};
	for (const [name, value] of params) {
		const existing = routeParams[name];
		routeParams[name] = existing === undefined ? value : [existing, value].flat();
	}
	return routeParams;
}
