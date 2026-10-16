import type { CompletedInviteDto } from '@/application/access/access-dtos';
import type { RouteSearchParams } from '@/components/recipe/recipe-list-params';
import { hrefWithParams } from '@/components/recipe/recipe-paths';
import { invitePath } from '@/lib/auth-paths';

export const signInPath = '/sign-in';

export const requestAccessPath = '/request-access';

export const accountPath = '/account';

export const adminPath = '/admin';

export const privacyPath = '/privacy';

// The sign-in page's parameter naming the page to return to.
export const nextParamName = 'next';

// The invite page's parameter once a code has signed the invitee in: whether the invite created
// their account, which the page shows when the flow loads it again.
export const inviteAccountParamName = 'account';

// Any origin parses the same; this one is reserved, so it can never be a real site.
const placeholderOrigin = 'https://next.invalid';

export function signInHref(next: string): string {
	return `${signInPath}?${new URLSearchParams({ [nextParamName]: next })}`;
}

// A page with the query it was requested with, repeated parameters included, so a page's own
// redirect to sign in returns to it as the proxy's does.
export function requestedPageHref(path: string, searchParams: RouteSearchParams): string {
	const params = new URLSearchParams();
	for (const [name, values] of Object.entries(searchParams)) {
		for (const value of [values ?? []].flat()) {
			params.append(name, value);
		}
	}
	return hrefWithParams(path, params);
}

// The invite page loaded again for the member a code signed in, saying whether the invite created
// their account.
export function joinedInviteHref(account: CompletedInviteDto['account']): string {
	return `${invitePath}?${new URLSearchParams({ [inviteAccountParamName]: account })}`;
}

// Only a path on this site, otherwise the recipe list; a repeated parameter counts as absent. A
// browser reads "//host" and "/\host" as another site, and drops tabs and newlines before parsing,
// so the path is checked as the browser parses it. Parsing also resolves dot segments, which can
// turn "/a/..//host" into "//host", so the result is checked again.
export function safeNextPath(value: string | string[] | undefined): string {
	if (
		typeof value !== 'string' ||
		!value.startsWith('/') ||
		!URL.canParse(value, placeholderOrigin)
	) {
		return '/';
	}

	const url = new URL(value, placeholderOrigin);
	if (url.origin !== placeholderOrigin || url.pathname.startsWith('//')) {
		return '/';
	}
	return `${url.pathname}${url.search}${url.hash}`;
}
