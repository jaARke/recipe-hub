import 'server-only';
import { passkey } from '@better-auth/passkey';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError } from 'better-auth/api';
import { nextCookies } from 'better-auth/next-js';
import { emailOTP } from 'better-auth/plugins';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type { SignUpGrant } from '@/application/access/access-dtos';
import { inviteIdSchema, type InviteId } from '@/domain/member/invite';
import {
	memberIdSchema,
	memberRoleSchema,
	sessionLifetimeDays,
	signInCodeLifetimeMinutes,
	type MemberId,
} from '@/domain/member/member';
import {
	accounts,
	passkeys,
	rateLimits,
	sessions,
	users,
	verifications,
} from '@/infrastructure/db/schema';
import { authBasePath, signInCodeRequestPath } from '@/lib/auth-paths';
import { withoutQueryParameters } from '@/lib/errors';
import { getLogger } from '@/lib/logger';
import { siteName } from '@/lib/site';

const secondsPerDay = 24 * 60 * 60;

// The routes the sign-in, invite, and account flows call, matched exactly. Any other path, mounted
// or not, answers 404 before Better Auth runs, so it costs no rate-limit write. A code request is
// served only at the path BotID checks.
const enabledPaths: ReadonlySet<string> = new Set([
	signInCodeRequestPath,
	...[
		'/get-session',
		'/sign-out',
		'/sign-in/email-otp',
		'/passkey/generate-register-options',
		'/passkey/verify-registration',
		'/passkey/generate-authenticate-options',
		'/passkey/verify-authentication',
		'/passkey/list-user-passkeys',
		'/passkey/delete-passkey',
	].map((path) => `${authBasePath}${path}`),
]);

const logger = getLogger('auth');

// The account use cases Better Auth's hooks call; AccountService provides them.
export type AuthAccountHooks = {
	sendSignInCode(email: string, code: string): Promise<void>;
	authorizeSignUp(email: string): Promise<SignUpGrant | null>;
	recordSignUp(memberId: MemberId, inviteId: InviteId): void;
};

export type AuthOptions = {
	db: PgDatabase<PgQueryResultHKT>;
	secret: string;
	// Hosts the app answers on, without a scheme; Better Auth refuses requests naming any other.
	allowedHosts: string[];
	// Production's host, which passkeys are bound to there; elsewhere they bind to the request's host.
	productionHost?: string;
	accounts: AuthAccountHooks;
	// Keeps work Better Auth starts after responding, such as sending a code, alive until it ends.
	runInBackground: (task: Promise<unknown>) => void;
};

// Better Auth's own warnings and errors, in the app's log format. A message can quote a query error.
function logBetterAuthMessage(level: string, message: string, ...args: unknown[]): void {
	const fields = {
		detail: withoutQueryParameters(message),
		err: args.find((arg) => arg instanceof Error),
	};
	if (level === 'error') {
		logger.error('Better Auth reported an error', fields);
	} else {
		logger.warn('Better Auth reported a warning', fields);
	}
}

// Serves the enabled paths only. A failure Better Auth throws is logged here, through the logger
// that cuts query parameters, and answered as better-call answers one.
function serveEnabledPaths(
	handler: (request: Request) => Promise<Response>
): (request: Request) => Promise<Response> {
	return async (request) => {
		const { pathname } = new URL(request.url);
		if (!enabledPaths.has(pathname)) {
			return new Response(null, { status: 404 });
		}

		try {
			return await handler(request);
		} catch (error) {
			logger.error('Better Auth request failed', { pathname, err: error });
			return new Response(null, { status: 500 });
		}
	};
}

export function createAuth(options: AuthOptions) {
	const { accounts: accountHooks } = options;

	const auth = betterAuth({
		secret: options.secret,
		baseURL: { allowedHosts: options.allowedHosts },
		basePath: authBasePath,
		database: drizzleAdapter(options.db, {
			provider: 'pg',
			schema: {
				user: users,
				session: sessions,
				account: accounts,
				verification: verifications,
				passkey: passkeys,
				rateLimit: rateLimits,
			},
			// Consumes each sign-in code and passkey challenge inside a transaction.
			transaction: true,
		}),
		logger: { level: 'warn', log: logBetterAuthMessage },
		// Thrown on to serveEnabledPaths, since better-call prints an unexpected error whole, a query
		// error's parameters included. API errors still answer with their status.
		onAPIError: { throw: true },
		advanced: {
			// Postgres fills ids with uuidv7().
			database: { generateId: 'uuid' },
			backgroundTasks: { handler: options.runInBackground },
		},
		user: {
			fields: { name: 'displayName' },
			additionalFields: {
				role: { type: [...memberRoleSchema.options], input: false, defaultValue: 'member' },
				inviteId: { type: 'string', input: false, required: false, unique: true },
				// Declared so session reads carry it, and the actor provider can refuse a removed member.
				removedAt: { type: 'date', input: false, required: false },
			},
		},
		session: { expiresIn: sessionLifetimeDays * secondsPerDay, updateAge: secondsPerDay },
		// On everywhere, not only when NODE_ENV is production, so every environment runs the same limits.
		rateLimit: {
			enabled: true,
			storage: 'database',
			customRules: {
				// Each ceremony stores a challenge, and the plugin sets no limit of its own.
				'/passkey/*': { window: 60, max: 10 },
			},
		},
		databaseHooks: {
			user: {
				create: {
					// Only an open invite bound to the address creates an account, and the invite decides
					// the rest, whatever the request sent. Inside hooks the name is Better Auth's `name`.
					before: async (user) => {
						const grant = await accountHooks.authorizeSignUp(user.email);
						if (grant === null) {
							throw new APIError('FORBIDDEN');
						}

						return {
							data: {
								name: grant.displayName,
								role: grant.role,
								inviteId: grant.inviteId,
								emailVerified: true,
								image: null,
							},
						};
					},
					after: async (user) => {
						accountHooks.recordSignUp(
							memberIdSchema.parse(user.id),
							inviteIdSchema.parse(user.inviteId)
						);
					},
				},
			},
		},
		plugins: [
			emailOTP({
				// Sign-up stays on so an invitee's first code creates the account; the create hook
				// refuses every address without an open invite.
				disableSignUp: false,
				otpLength: 6,
				expiresIn: signInCodeLifetimeMinutes * 60,
				allowedAttempts: 3,
				storeOTP: 'encrypted',
				// Runs in the background, so the response never reveals whether an email went out.
				sendVerificationOTP: async ({ email, otp, type }) => {
					if (type === 'sign-in') {
						await accountHooks.sendSignInCode(email, otp);
					}
				},
			}),
			passkey({
				rpName: siteName,
				rpID: options.productionHost,
				// A discoverable credential lets the sign-in page's autofill offer it without an address.
				authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
			}),
			// Last, so it forwards cookies that earlier plugins set.
			nextCookies(),
		],
	});

	// fetch is Better Auth's other name for its handler.
	const handler = serveEnabledPaths(auth.handler);
	return { ...auth, handler, fetch: handler };
}

export type Auth = ReturnType<typeof createAuth>;
