// Better Auth names each of its cookies `${prefix}.${cookie}`, under this prefix by default.
const betterAuthPrefix = 'better-auth';

// A browser keeps a __Host- cookie only if it is Secure, has Path=/, and names no Domain, which binds
// it to the host that set it.
const hostPrefix = `__Host-${betterAuthPrefix}`;

// The prefix of every auth cookie's name: __Host- where cookies are Secure, and Better Auth's own
// elsewhere, as over http on the dev server, where a browser may refuse a Secure cookie.
export function authCookiePrefix(secure: boolean): string {
	return secure ? hostPrefix : betterAuthPrefix;
}

// The session cookie's name under either prefix.
export const sessionCookieNames: readonly string[] = [hostPrefix, betterAuthPrefix].map(
	(prefix) => `${prefix}.session_token`
);
