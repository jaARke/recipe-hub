import { betterAuth } from 'better-auth';
import { testUtils, type TestCookie } from 'better-auth/plugins';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { MemberId } from '@/domain/member/member';
import { betterAuthOptions, type AuthAccountHooks } from '@/infrastructure/auth/better-auth';
import { devServerUrl } from './dev-server';
import { reportQueryErrorsWithoutParameters } from './develop-database';
import { endToEndEnv } from './env';

// The instance mints sessions and reads codes in the test process and serves no request, so nothing
// here sends an email or judges a request.
function servesNoRequests(): never {
	throw new Error('The end-to-end auth instance serves no requests');
}

const noAccountHooks: AuthAccountHooks = {
	sendSignInCode: servesNoRequests,
	authorizeSignUp: servesNoRequests,
	recordSignUp: servesNoRequests,
};

export type EndToEndAuth = ReturnType<typeof createEndToEndAuth>;

// Better Auth as the dev server runs it, on the same options, database, and secret, with the
// testUtils plugin, which no deployment carries. The setup project checks that the dev server reads
// the sessions it mints (e2e/auth.setup.ts).
export function createEndToEndAuth(db: NodePgDatabase) {
	const options = betterAuthOptions({
		db,
		secret: endToEndEnv.BETTER_AUTH_SECRET,
		allowedHosts: [devServerUrl.host],
		// As on the dev server over http, so the cookies take Better Auth's plain names.
		secureCookies: false,
		accounts: noAccountHooks,
		runInBackground: servesNoRequests,
		checkBotId: servesNoRequests,
	});
	// First, so next-cookies stays last.
	const auth = betterAuth({ ...options, plugins: [testUtils(), ...options.plugins] });

	return {
		// A new session for the member, as the cookies signing in on the dev server sets.
		sessionCookies(memberId: MemberId): Promise<TestCookie[]> {
			return reportQueryErrorsWithoutParameters(async () => {
				const { test } = await auth.$context;
				return test.getCookies({ userId: memberId, domain: devServerUrl.hostname });
			});
		},

		// The sign-in code the dev server stored for the address, or null before it stores one. A call
		// names the host, which Better Auth resolves its base URL from among the allowed hosts.
		signInCode(email: string): Promise<string | null> {
			return reportQueryErrorsWithoutParameters(async () => {
				const { otp } = await auth.api.getVerificationOTP({
					query: { email, type: 'sign-in' },
					headers: new Headers({ host: devServerUrl.host }),
				});
				return otp;
			});
		},
	};
}
