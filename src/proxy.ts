import { NextResponse, type NextRequest } from 'next/server';
import { signInHref } from '@/components/auth/auth-paths';
import { recipeListPath, recipeSearchPath } from '@/components/recipe/recipe-paths';
import { misplacedRecipeSearchHref } from '@/components/search/search-params';
import { sessionCookieNames } from '@/lib/auth-cookies';
import { routeSearchParams } from '@/lib/url-query';

// Browse and Search answer a request in the other's mode with a redirect before the page renders,
// since a page's own redirect comes after its shell has streamed a 200.
function redirectToSearchMode(request: NextRequest) {
	const { pathname, searchParams } = request.nextUrl;
	const href = misplacedRecipeSearchHref(pathname, routeSearchParams(searchParams));
	return href === undefined
		? NextResponse.next()
		: NextResponse.redirect(new URL(href, request.url));
}

// An optimistic check: a cookie that is present but expired or forged reaches the page, and the
// application layer refuses it there. So either of the session cookie's names lets a request
// through, and the proxy needs no environment to know which one the auth config sets.
function requireSession(request: NextRequest) {
	if (sessionCookieNames.some((name) => request.cookies.has(name))) {
		return NextResponse.next();
	}

	const next = `${request.nextUrl.pathname}${request.nextUrl.search}`;
	return NextResponse.redirect(new URL(signInHref(next), request.url));
}

export function proxy(request: NextRequest) {
	const { pathname } = request.nextUrl;
	return pathname === recipeListPath || pathname === recipeSearchPath
		? redirectToSearchMode(request)
		: requireSession(request);
}

// Literals, which Next reads without running this module. Browse is matched only with a query,
// recipeSearchParamNames.text, so its own requests skip the proxy; every search is matched, since an
// empty or blank query is no query.
export const config = {
	matcher: [
		'/contribute/:path*',
		'/recipes/:slug/edit',
		'/admin/:path*',
		'/account/:path*',
		{ source: '/', has: [{ type: 'query', key: 'q' }] },
		'/search',
	],
};
