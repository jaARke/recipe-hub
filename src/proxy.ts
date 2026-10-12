import { getSessionCookie } from 'better-auth/cookies';
import { NextResponse, type NextRequest } from 'next/server';

// An optimistic check: a cookie that is present but expired or forged reaches the page, and the
// application layer refuses it there. The auth config keeps Better Auth's default cookie name.
export function proxy(request: NextRequest) {
	if (getSessionCookie(request) !== null) {
		return NextResponse.next();
	}

	const signIn = new URL('/sign-in', request.url);
	signIn.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`);
	return NextResponse.redirect(signIn);
}

export const config = {
	matcher: ['/contribute/:path*', '/admin/:path*', '/account/:path*'],
};
