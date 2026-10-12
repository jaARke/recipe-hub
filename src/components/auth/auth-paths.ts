export const signInPath = '/sign-in';

export const requestAccessPath = '/request-access';

export const accountPath = '/account';

export const adminPath = '/admin';

export const privacyPath = '/privacy';

// The sign-in page's parameter naming the page to return to.
export const nextParamName = 'next';

// Any origin parses the same; this one is reserved, so it can never be a real site.
const placeholderOrigin = 'https://next.invalid';

export function signInHref(next: string): string {
	return `${signInPath}?${new URLSearchParams({ [nextParamName]: next })}`;
}

// Only a path on this site, otherwise the recipe list; a repeated parameter counts as absent. A
// browser reads "//host" and "/\host" as another site, and drops tabs and newlines before parsing,
// so the path is checked as the browser parses it.
export function safeNextPath(value: string | string[] | undefined): string {
	if (typeof value !== 'string' || !value.startsWith('/')) {
		return '/';
	}

	const url = new URL(value, placeholderOrigin);
	return url.origin === placeholderOrigin ? `${url.pathname}${url.search}${url.hash}` : '/';
}
