import { NextResponse, type NextRequest } from 'next/server';
import { signInHref } from '@/components/auth/auth-paths';
import { sessionCookieNames } from '@/lib/auth-cookies';

// An optimistic check: a cookie that is present but expired or forged reaches the page, and the
// application layer refuses it there. So either of the session cookie's names lets a request
// through, and the proxy needs no environment to know which one the auth config sets.
export function proxy(request: NextRequest) {
	if (sessionCookieNames.some((name) => request.cookies.has(name))) {
		return NextResponse.next();
	}

	const next = `${request.nextUrl.pathname}${request.nextUrl.search}`;
	return NextResponse.redirect(new URL(signInHref(next), request.url));
}

export const config = {
	matcher: ['/contribute/:path*', '/recipes/:slug/edit', '/admin/:path*', '/account/:path*'],
};
