// A page's searchParams as Next.js passes them: a repeated parameter arrives as an array.
export type RouteSearchParams = Record<string, string | string[] | undefined>;

// A path with its query, or the path alone when there is none, so a page has one URL without one.
export function hrefWithParams(path: string, params: URLSearchParams): string {
	const query = params.toString();
	return query === '' ? path : `${path}?${query}`;
}

// Takes the parameter out of the browser's address in place, without a navigation, so a reload or a
// copied link no longer carries it. True when the address had it.
export function removeAddressParam(name: string): boolean {
	const url = new URL(window.location.href);
	if (!url.searchParams.has(name)) {
		return false;
	}
	url.searchParams.delete(name);
	window.history.replaceState(
		null,
		'',
		`${hrefWithParams(url.pathname, url.searchParams)}${url.hash}`
	);
	return true;
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
