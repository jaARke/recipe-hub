import 'server-only';
import { getAuthenticatorName, passkey } from '@better-auth/passkey';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { nextCookies } from 'better-auth/next-js';
import { captcha, emailOTP, type VercelBotIdOptions } from 'better-auth/plugins';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type { SignUpGrant } from '@/application/access/access-dtos';
import { inviteIdSchema, type InviteId } from '@/domain/member/invite';
import {
	memberIdSchema,
	memberRoleSchema,
	passkeyNameSchema,
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
import { authCookiePrefix } from '@/lib/auth-cookies';
import { authBasePath, signInCodeRequestPath } from '@/lib/auth-paths';
import { withoutQueryParameters } from '@/lib/errors';
import { getLogger } from '@/lib/logger';
import { settings } from '@/lib/settings';
import { siteName } from '@/lib/site';

const secondsPerDay = 24 * 60 * 60;

// Better Auth's plugins and rules name routes without the base path.
const signInCodeRequestRoute = signInCodeRequestPath.slice(authBasePath.length);
const passkeyRegistrationRoute = '/passkey/verify-registration';
const passkeyRenameRoute = '/passkey/update-passkey';

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
		passkeyRegistrationRoute,
		'/passkey/generate-authenticate-options',
		'/passkey/verify-authentication',
		'/passkey/list-user-passkeys',
		'/passkey/delete-passkey',
		passkeyRenameRoute,
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
	// Whether cookies travel over HTTPS alone, where each auth cookie's name takes the __Host- prefix.
	secureCookies: boolean;
	accounts: AuthAccountHooks;
	// Keeps work Better Auth starts after responding, such as sending a code, alive until it ends.
	runInBackground: (task: Promise<unknown>) => void;
	// BotID's verdict on the current request, which judges each sign-in code request.
	checkBotId: VercelBotIdOptions['checkBotId'];
};

// Better Auth's own warnings and errors, in the app's log format. A message can quote a query error.
// An error comes as an argument or, from the captcha plugin, as a field of one.
function logBetterAuthMessage(level: string, message: string, ...args: unknown[]): void {
	const values = args.flatMap((arg) =>
		arg !== null && typeof arg === 'object' && !(arg instanceof Error) ? Object.values(arg) : [arg]
	);
	const fields = {
		detail: withoutQueryParameters(message),
		err: values.find((value) => value instanceof Error),
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
			// Names every cookie Better Auth and its plugins set, the passkey challenge's included. Its
			// own __Secure- prefix, which it would add by NODE_ENV ahead of __Host-, stays off.
			cookiePrefix: authCookiePrefix(options.secureCookies),
			useSecureCookies: false,
			defaultCookieAttributes: { secure: options.secureCookies },
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
		session: {
			expiresIn: settings.accounts.sessionLifetimeDays * secondsPerDay,
			updateAge: secondsPerDay,
		},
		// On everywhere, not only when NODE_ENV is production, so every environment runs the same limits.
		// The forms' "Wait a minute" (auth-errors.ts) holds while no window here is longer than 60
		// seconds.
		rateLimit: {
			enabled: true,
			storage: 'database',
			customRules: {
				// Each code request can spend an email, and each code sign-in is a guess.
				[signInCodeRequestRoute]: { window: 60, max: 3 },
				'/sign-in/email-otp': { window: 60, max: 3 },
				// Each ceremony stores a challenge, and the plugin sets no limit of its own.
				'/passkey/*': { window: 60, max: 10 },
			},
		},
		hooks: {
			// A passkey's name is checked, and stored, as a display name is: always on a rename, and on a
			// registration that names one. A registration without one takes its authenticator's.
			before: createAuthMiddleware(async (context) => {
				const named =
					context.path === passkeyRenameRoute ||
					(context.path === passkeyRegistrationRoute && context.body?.name !== undefined);
				if (!named) {
					return;
				}

				const name = passkeyNameSchema.safeParse(context.body?.name);
				if (!name.success) {
					throw new APIError('BAD_REQUEST', {
						code: 'VALIDATION_ERROR',
						message: name.error.issues[0]?.message,
					});
				}
				return { context: { body: { ...context.body, name: name.data } } };
			}),
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
				expiresIn: settings.accounts.signInCodeLifetimeMinutes * 60,
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
				// Named for the password manager or device that made it, when its AAGUID says which.
				// iCloud Keychain sends an all-zero AAGUID without attestation, so its passkeys stay unnamed.
				registration: {
					afterVerification: ({ verification }) => ({
						name: getAuthenticatorName(verification.registrationInfo?.aaguid),
					}),
				},
			}),
			// BotID judges a code request before it can spend an email; a bot gets the forms' usual
			// failure message. The browser marks the same requests in instrumentation-client.ts.
			captcha({
				provider: 'vercel-botid',
				endpoints: [signInCodeRequestRoute],
				checkBotId: options.checkBotId,
				validateRequest: ({ verification }) => {
					if (verification.isBot) {
						logger.warn('Sign-in code request refused as automated');
					}
					return !verification.isBot;
				},
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
