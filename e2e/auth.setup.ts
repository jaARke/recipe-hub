import { authCookiePrefix } from '@/lib/auth-cookies';
import { authBasePath } from '@/lib/auth-paths';
import { expect, test as setup } from './support/fixtures';

// The drift check between the dev server's Better Auth and the suites' test-only instance: a
// session the instance mints is one the dev server reads, so every signed-in flow starts signed in.
setup(
	'the dev server reads a session the test-only auth instance mints',
	async ({ context, member, signIn }) => {
		await signIn();
		const cookies = await context.cookies();
		// The dev server serves http, so its cookies carry Better Auth's plain names rather than __Host-.
		expect(cookies.map(({ name }) => name)).toEqual([`${authCookiePrefix(false)}.session_token`]);

		const response = await context.request.get(`${authBasePath}/get-session`);
		expect(response.ok()).toBe(true);
		const session = (await response.json()) as { user: { id: string } } | null;
		expect(
			session?.user.id,
			'The dev server must run from this tree with .env.local, and createAuth must build on betterAuthOptions'
		).toBe(member.id);
	}
);
