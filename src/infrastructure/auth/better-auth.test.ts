import { getSessionCookie } from 'better-auth/cookies';
import { checkBotId } from 'botid/server';
import { eq, sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { InviteUnavailableError } from '@/application/access/errors';
import { InviteService } from '@/application/access/invite-service';
import { actorFor } from '@/application/testing/actors';
import { FixedActorProvider } from '@/application/testing/fixed-actor-provider';
import type { InMemoryEmailSender } from '@/application/testing/in-memory-email-sender';
import type { Auth } from '@/infrastructure/auth/better-auth';
import {
	cookiesFrom,
	createTestAuth,
	testHost,
	testOrigin,
} from '@/infrastructure/auth/testing/test-auth';
import { passkeyRegistrationResponse } from '@/infrastructure/auth/testing/test-passkeys';
import { DrizzleAccessRequestRepository } from '@/infrastructure/db/drizzle-access-request-repository';
import { DrizzleInviteRepository } from '@/infrastructure/db/drizzle-invite-repository';
import { DrizzleMemberRepository } from '@/infrastructure/db/drizzle-member-repository';
import { passkeys, rateLimits, sessions, users, verifications } from '@/infrastructure/db/schema';
import { createTestDatabase, type TestDatabase } from '@/infrastructure/db/testing/test-database';
import { settings } from '@/lib/settings';

const clientIp = '198.51.100.7';
const sessionLifetimeSeconds = settings.accounts.sessionLifetimeDays * 24 * 60 * 60;

// The routes the sign-in, invite, and account flows call; every other route answers 404.
const enabledPaths = [
	'/get-session',
	'/sign-out',
	'/email-otp/send-verification-otp',
	'/sign-in/email-otp',
	'/passkey/generate-register-options',
	'/passkey/verify-registration',
	'/passkey/generate-authenticate-options',
	'/passkey/verify-authentication',
	'/passkey/list-user-passkeys',
	'/passkey/delete-passkey',
	'/passkey/update-passkey',
];

// AAGUIDs from the community list of passkey providers that Better Auth's names follow.
const googlePasswordManagerAaguid = 'ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4';
const anonymousAaguid = '00000000-0000-0000-0000-000000000000';

type Route = { path: string; method: string };

let db: TestDatabase;
let members: DrizzleMemberRepository;
let emails: InMemoryEmailSender;
let auth: Auth;
let backgroundWork: () => Promise<void>;
let consoleInfo: MockInstance<typeof console.info>;

beforeEach(async () => {
	db = await createTestDatabase();
	members = new DrizzleMemberRepository(db);
	({ auth, emails, backgroundWork } = createTestAuth(db));
	// Keeps log lines out of the test output; the logging test reads them here.
	consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => {});
});

afterEach(async () => {
	vi.restoreAllMocks();
	await db.$client.close();
});

// Calls the handler as a browser on the dev server would.
function request(method: string, path: string, body?: object, cookie?: string): Promise<Response> {
	const headers = new Headers({ origin: testOrigin, 'x-forwarded-for': clientIp });
	if (body !== undefined) {
		headers.set('content-type', 'application/json');
	}
	if (cookie !== undefined) {
		headers.set('cookie', cookie);
	}

	return auth.handler(
		new Request(`${testOrigin}/api/auth${path}`, {
			method,
			headers,
			body: body === undefined ? undefined : JSON.stringify(body),
		})
	);
}

// Waits for the email Better Auth sends after answering.
async function requestCode(email: string): Promise<Response> {
	const response = await request('POST', '/email-otp/send-verification-otp', {
		email,
		type: 'sign-in',
	});
	await backgroundWork();
	return response;
}

function codeSentTo(email: string): string {
	const message = emails.sentMessages.findLast((sent) => sent.to === email);
	const code = message?.text.match(/sign-in code is:\n\n(\d{6})/)?.[1];
	if (code === undefined) {
		throw new Error('No code was sent to the address');
	}
	return code;
}

async function signIn(email: string, fields: object = {}): Promise<Response> {
	await requestCode(email);
	return request('POST', '/sign-in/email-otp', { email, otp: codeSentTo(email), ...fields });
}

// A code made without sending it, for an address that would never be sent one.
function unsentCode(email: string): Promise<string> {
	return auth.api.createVerificationOTP({
		body: { email, type: 'sign-in' },
		headers: new Headers({ host: testHost }),
	});
}

function sessionCookieAttributes(response: Response): string | undefined {
	return response.headers
		.getSetCookie()
		.find((cookie) => cookie.startsWith('better-auth.session_token='));
}

function mountedRoutes(): Route[] {
	const endpoints = Object.values(auth.api) as { path?: string; options: { method: unknown } }[];
	return endpoints.flatMap(({ path, options }) => {
		const methods = [options.method].flat();
		return path === undefined ? [] : [{ path, method: String(methods[0]) }];
	});
}

async function inviteGrace() {
	const admin = await members.create({
		email: 'jake@example.com',
		displayName: 'Jake',
		role: 'admin',
	});
	const invites = new DrizzleInviteRepository(db);
	const service = new InviteService(
		invites,
		new DrizzleAccessRequestRepository(db),
		members,
		emails,
		new FixedActorProvider(actorFor(admin)),
		new URL(testOrigin)
	);
	const issued = await service.issueInvite({ displayName: 'Grace Hopper' });
	const token = new URL(issued.link).hash.slice(1);
	await service.bindInviteEmail(token, 'Grace@Example.com');
	return { service, inviteId: issued.id, token };
}

async function storedUser(email: string) {
	const [row] = await db
		.select({ inviteId: users.inviteId, emailVerified: users.emailVerified, image: users.image })
		.from(users)
		.where(eq(users.email, email));
	return row;
}

// Registers a passkey, made by an authenticator with this AAGUID, for the signed-in member. A name
// is sent only as a crafted request would; the site's own form sends none.
async function registerPasskey(
	sessionCookie: string,
	aaguid: string,
	name?: string
): Promise<Response> {
	const options = await request(
		'GET',
		'/passkey/generate-register-options',
		undefined,
		sessionCookie
	);
	const { challenge } = (await options.json()) as { challenge: string };
	const response = passkeyRegistrationResponse({ challenge, origin: testOrigin, aaguid });

	return request(
		'POST',
		'/passkey/verify-registration',
		{ response, name },
		`${sessionCookie}; ${cookiesFrom(options.headers)}`
	);
}

// Ada, signed in, with one passkey of this name.
async function adaWithPasskey(name: string) {
	const ada = await members.create({
		email: 'ada@example.com',
		displayName: 'Ada',
		role: 'member',
	});
	const [stored] = await db
		.insert(passkeys)
		.values({
			name,
			publicKey: 'public-key',
			userId: ada.id,
			credentialID: 'ada-credential',
			counter: 0,
			deviceType: 'multiDevice',
			backedUp: true,
		})
		.returning({ id: passkeys.id });
	const signedIn = await signIn('ada@example.com');
	return { passkeyId: stored!.id, sessionCookie: cookiesFrom(signedIn.headers) };
}

async function passkeyNames(): Promise<(string | null)[]> {
	const rows = await db.select({ name: passkeys.name }).from(passkeys);
	return rows.map((row) => row.name);
}

describe('sending a sign-in code', () => {
	it('emails a member a code', async () => {
		await members.create({ email: 'ada@example.com', displayName: 'Ada', role: 'member' });

		const response = await requestCode('ada@example.com');

		expect(response.status).toBe(200);
		expect(codeSentTo('ada@example.com')).toMatch(/^\d{6}$/);
	});

	it('answers an unknown address as it answers a member, with no email and no account', async () => {
		await members.create({ email: 'ada@example.com', displayName: 'Ada', role: 'member' });

		const forMember = await requestCode('ada@example.com');
		const forStranger = await requestCode('stranger@example.com');

		expect(forStranger.status).toBe(forMember.status);
		expect(await forStranger.json()).toEqual(await forMember.json());
		expect(emails.sentMessages.map((message) => message.to)).toEqual(['ada@example.com']);
		expect(await members.findByEmail('stranger@example.com')).toBeNull();
	});

	it('answers a removed member as it answers an unknown address, with no email', async () => {
		const ada = await members.create({
			email: 'ada@example.com',
			displayName: 'Ada',
			role: 'member',
		});
		await members.remove(ada.id);

		const forRemoved = await requestCode('ada@example.com');
		const forStranger = await requestCode('stranger@example.com');

		expect(forRemoved.status).toBe(forStranger.status);
		expect(await forRemoved.json()).toEqual(await forStranger.json());
		expect(emails.sentMessages).toEqual([]);
	});
});

describe('BotID on code requests', () => {
	// BotID reports that no browser check came with the request, which a test cannot send.
	beforeEach(() => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	it('refuses a request BotID classifies as a bot, with no email, and logs it', async () => {
		({ auth, emails, backgroundWork } = createTestAuth(db, {
			checkBotId: () => checkBotId({ developmentOptions: { bypass: 'BAD-BOT' } }),
		}));
		await members.create({ email: 'ada@example.com', displayName: 'Ada', role: 'member' });
		const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

		const response = await requestCode('ada@example.com');

		expect(response.status).toBe(403);
		expect(emails.sentMessages).toEqual([]);
		const logged = consoleWarn.mock.calls.map(([line]) => JSON.parse(String(line)));
		expect(logged).toContainEqual(
			expect.objectContaining({ message: 'Sign-in code request refused as automated' })
		);
	});

	it('sends a code to a request BotID classifies as human', async () => {
		({ auth, emails, backgroundWork } = createTestAuth(db, {
			checkBotId: () => checkBotId({ developmentOptions: { bypass: 'HUMAN' } }),
		}));
		await members.create({ email: 'ada@example.com', displayName: 'Ada', role: 'member' });

		const response = await requestCode('ada@example.com');

		expect(response.status).toBe(200);
		expect(codeSentTo('ada@example.com')).toMatch(/^\d{6}$/);
	});

	it('checks no other route', async () => {
		({ auth, emails, backgroundWork } = createTestAuth(db, {
			checkBotId: () => checkBotId({ developmentOptions: { bypass: 'BAD-BOT' } }),
		}));

		const session = await request('GET', '/get-session');
		const passkeyOptions = await request('GET', '/passkey/generate-authenticate-options');

		expect([session.status, passkeyOptions.status]).toEqual([200, 200]);
	});
});

describe('rate limits', () => {
	// The forms ask a refused visitor to wait a minute.
	it.each([
		{
			routes: 'code requests',
			limit: 3,
			method: 'POST',
			path: '/email-otp/send-verification-otp',
			body: { email: 'ada@example.com', type: 'sign-in' },
		},
		{
			routes: 'code sign-ins',
			limit: 3,
			method: 'POST',
			path: '/sign-in/email-otp',
			body: { email: 'ada@example.com', otp: '000000' },
		},
		{
			routes: 'passkey routes',
			limit: 10,
			method: 'GET',
			path: '/passkey/generate-authenticate-options',
			body: undefined,
		},
	])(
		'refuses $routes past $limit a minute from one client, for a minute at most',
		async ({ limit, method, path, body }) => {
			const statuses: number[] = [];
			for (let attempt = 0; attempt < limit; attempt += 1) {
				statuses.push((await request(method, path, body)).status);
			}
			const refused = await request(method, path, body);
			await backgroundWork();

			expect(statuses).not.toContain(429);
			expect(refused.status).toBe(429);
			const retryAfterSeconds = Number(refused.headers.get('x-retry-after'));
			expect(retryAfterSeconds).toBeGreaterThan(0);
			expect(retryAfterSeconds).toBeLessThanOrEqual(60);
		}
	);
});

describe('signing in with a code', () => {
	it('signs in a member', async () => {
		const ada = await members.create({
			email: 'ada@example.com',
			displayName: 'Ada',
			role: 'member',
		});

		const response = await signIn('ada@example.com');
		const session = await auth.api.getSession({
			headers: new Headers({ cookie: cookiesFrom(response.headers), host: testHost }),
		});

		expect(response.status).toBe(200);
		expect(session?.user.id).toBe(ada.id);
	});

	it('sets the session cookie the proxy looks for', async () => {
		await members.create({ email: 'ada@example.com', displayName: 'Ada', role: 'member' });

		const response = await signIn('ada@example.com');

		expect(getSessionCookie(new Headers({ cookie: cookiesFrom(response.headers) }))).not.toBeNull();
	});

	it('refuses an account for an address without an open invite', async () => {
		const response = await request('POST', '/sign-in/email-otp', {
			email: 'stranger@example.com',
			otp: await unsentCode('stranger@example.com'),
		});

		expect(response.status).toBe(403);
		expect(await members.findByEmail('stranger@example.com')).toBeNull();
	});
});

describe('accepting an invite', () => {
	it('creates the invited member, signs them in for 180 days, and closes the invite', async () => {
		const { service, inviteId, token } = await inviteGrace();

		const response = await signIn('grace@example.com');
		const grace = await members.findByEmail('grace@example.com');

		expect(response.status).toBe(200);
		expect(grace).toMatchObject({ displayName: 'Grace Hopper', role: 'member' });
		expect(await storedUser('grace@example.com')).toMatchObject({ inviteId, emailVerified: true });
		expect(sessionCookieAttributes(response)).toContain(`Max-Age=${sessionLifetimeSeconds}`);
		expect(await service.getInvitePreview(token)).toBeNull();
		const logged = consoleInfo.mock.calls.map(([line]) => JSON.parse(String(line)));
		expect(logged).toContainEqual(
			expect.objectContaining({ message: 'Access granted', memberId: grace?.id, inviteId })
		);
	});

	it('takes the name and role from the invite, whatever the request sends', async () => {
		await inviteGrace();

		const response = await signIn('grace@example.com', {
			name: 'Admiral Hopper',
			role: 'admin',
			image: 'https://example.com/portrait.png',
		});

		expect(response.status).toBe(200);
		expect(await members.findByEmail('grace@example.com')).toMatchObject({
			displayName: 'Grace Hopper',
			role: 'member',
		});
		expect(await storedUser('grace@example.com')).toMatchObject({ image: null });
	});

	it('refuses a request that names an invite', async () => {
		const { inviteId } = await inviteGrace();

		const response = await signIn('grace@example.com', { inviteId });

		expect(response.status).toBe(400);
		expect(await members.findByEmail('grace@example.com')).toBeNull();
	});

	it('creates a new account for a removed member invited again, and closes the new invite', async () => {
		const { service } = await inviteGrace();
		await signIn('grace@example.com');
		const removed = await members.findByEmail('grace@example.com');
		await members.remove(removed!.id);
		const reissued = await service.issueInvite({ displayName: 'Grace' });
		const token = new URL(reissued.link).hash.slice(1);
		await service.bindInviteEmail(token, 'grace@example.com');

		const response = await signIn('grace@example.com');
		const grace = await members.findByEmail('grace@example.com');

		expect(emails.sentMessages.filter(({ to }) => to === 'grace@example.com')).toHaveLength(2);
		expect(response.status).toBe(200);
		expect(grace).toMatchObject({ displayName: 'Grace', role: 'member' });
		expect(grace?.id).not.toBe(removed?.id);
		expect(await storedUser('grace@example.com')).toMatchObject({ inviteId: reissued.id });
		expect(await members.findById(removed!.id)).toMatchObject({ removedAt: expect.any(Date) });
		expect(await service.getInvitePreview(token)).toBeNull();
	});

	it('refuses a second account on an accepted invite', async () => {
		const { service, token } = await inviteGrace();
		await signIn('grace@example.com');

		await expect(service.bindInviteEmail(token, 'lin@example.com')).rejects.toThrow(
			InviteUnavailableError
		);
		const response = await request('POST', '/sign-in/email-otp', {
			email: 'lin@example.com',
			otp: await unsentCode('lin@example.com'),
		});

		expect(response.status).toBe(403);
		expect(await members.findByEmail('lin@example.com')).toBeNull();
	});
});

describe('passkeys', () => {
	it('refuses registration options without a session', async () => {
		const response = await request('GET', '/passkey/generate-register-options');

		expect(response.status).toBe(401);
	});

	it('asks for a discoverable credential bound to the request host', async () => {
		await members.create({ email: 'ada@example.com', displayName: 'Ada', role: 'member' });
		const signedIn = await signIn('ada@example.com');

		const response = await request(
			'GET',
			'/passkey/generate-register-options',
			undefined,
			cookiesFrom(signedIn.headers)
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			rp: { name: 'Barb’s Table', id: 'localhost' },
			authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
		});
	});

	it('binds credentials to the production host on production', async () => {
		({ auth, emails, backgroundWork } = createTestAuth(db, {
			productionHost: 'recipes.example.com',
		}));
		await members.create({ email: 'ada@example.com', displayName: 'Ada', role: 'member' });
		const signedIn = await signIn('ada@example.com');

		const response = await request(
			'GET',
			'/passkey/generate-register-options',
			undefined,
			cookiesFrom(signedIn.headers)
		);

		expect(await response.json()).toMatchObject({ rp: { id: 'recipes.example.com' } });
	});

	it("refuses a sign-in naming a removed member's passkey", async () => {
		const ada = await members.create({
			email: 'ada@example.com',
			displayName: 'Ada',
			role: 'member',
		});
		await db.insert(passkeys).values({
			publicKey: 'public-key',
			userId: ada.id,
			credentialID: 'ada-credential',
			counter: 0,
			deviceType: 'multiDevice',
			backedUp: true,
		});
		await members.remove(ada.id);
		const options = await request('GET', '/passkey/generate-authenticate-options');

		// The plugin finds the credential before it checks the signature, so none is sent.
		const response = await request(
			'POST',
			'/passkey/verify-authentication',
			{ response: { id: 'ada-credential' } },
			cookiesFrom(options.headers)
		);

		expect(response.status).toBe(401);
		expect(await response.json()).toMatchObject({ code: 'PASSKEY_NOT_FOUND' });
		expect(await db.$count(sessions)).toBe(0);
	});

	it('names a new passkey for the password manager that made it', async () => {
		await members.create({ email: 'ada@example.com', displayName: 'Ada', role: 'member' });
		const signedIn = await signIn('ada@example.com');

		const response = await registerPasskey(
			cookiesFrom(signedIn.headers),
			googlePasswordManagerAaguid
		);

		expect(response.status).toBe(200);
		expect(await passkeyNames()).toEqual(['Google Password Manager']);
	});

	it('leaves a passkey unnamed when its authenticator does not say what it is', async () => {
		await members.create({ email: 'ada@example.com', displayName: 'Ada', role: 'member' });
		const signedIn = await signIn('ada@example.com');

		const response = await registerPasskey(cookiesFrom(signedIn.headers), anonymousAaguid);

		expect(response.status).toBe(200);
		expect(await passkeyNames()).toEqual([null]);
	});

	it('renames a passkey, trimmed as a display name is', async () => {
		const { passkeyId, sessionCookie } = await adaWithPasskey('Passkey');

		const response = await request(
			'POST',
			'/passkey/update-passkey',
			{ id: passkeyId, name: '  Kitchen iPad  ' },
			sessionCookie
		);

		expect(response.status).toBe(200);
		expect(await passkeyNames()).toEqual(['Kitchen iPad']);
	});

	it.each([
		['an empty name', '   ', 'Enter some text.'],
		['a name over 60 characters', 'a'.repeat(61), 'Use 60 characters or fewer.'],
	])('refuses %s, saying why', async (_, name, message) => {
		const { passkeyId, sessionCookie } = await adaWithPasskey('Passkey');

		const response = await request(
			'POST',
			'/passkey/update-passkey',
			{ id: passkeyId, name },
			sessionCookie
		);

		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({ code: 'VALIDATION_ERROR', message });
		expect(await passkeyNames()).toEqual(['Passkey']);
	});

	it('refuses a registration that names its passkey with over 60 characters', async () => {
		await members.create({ email: 'ada@example.com', displayName: 'Ada', role: 'member' });
		const signedIn = await signIn('ada@example.com');

		const response = await registerPasskey(
			cookiesFrom(signedIn.headers),
			googlePasswordManagerAaguid,
			'a'.repeat(61)
		);

		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({
			code: 'VALIDATION_ERROR',
			message: 'Use 60 characters or fewer.',
		});
		expect(await passkeyNames()).toEqual([]);
	});

	it('stores a name a registration sends, trimmed as a display name is', async () => {
		await members.create({ email: 'ada@example.com', displayName: 'Ada', role: 'member' });
		const signedIn = await signIn('ada@example.com');

		const response = await registerPasskey(
			cookiesFrom(signedIn.headers),
			googlePasswordManagerAaguid,
			'  Work laptop  '
		);

		expect(response.status).toBe(200);
		expect(await passkeyNames()).toEqual(['Work laptop']);
	});
});

describe('routes', () => {
	it('answers 404 on every route the flows do not call, parameterized ones included', async () => {
		const unused = mountedRoutes().filter(({ path }) => !enabledPaths.includes(path));

		for (const { path, method } of unused) {
			const requested = path.replace(/:\w+/g, 'sample');
			expect((await request(method, requested)).status, path).toBe(404);
		}
		expect(unused.filter(({ path }) => path.includes(':'))).not.toHaveLength(0);
	});

	it('serves every route the flows call', async () => {
		const routes = mountedRoutes().filter(({ path }) => enabledPaths.includes(path));

		expect(routes.map(({ path }) => path).toSorted()).toEqual(enabledPaths.toSorted());
		for (const { path, method } of routes) {
			expect((await request(method, path)).status, path).not.toBe(404);
		}
	});

	it('answers a path it does not serve without a rate-limit row', async () => {
		const unknown = await request('POST', '/no-such-route');
		const unused = await request('POST', '/update-user', { name: 'Ada' });

		expect([unknown.status, unused.status]).toEqual([404, 404]);
		expect(await db.$count(rateLimits)).toBe(0);
		await request('GET', '/get-session');
		expect(await db.$count(rateLimits)).toBe(1);
	});
});

describe('logging', () => {
	it.each([
		['a route', 'users', 'ada@example.com'],
		['the rate limiter', 'rate_limits', clientIp],
	])(
		'answers 500 and logs a failed query in %s without its parameters',
		async (_, table, parameter) => {
			await members.create({ email: 'ada@example.com', displayName: 'Ada', role: 'member' });
			await db.execute(sql`drop table ${sql.identifier(table)} cascade`);
			const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

			const response = await requestCode('ada@example.com');

			expect(response.status).toBe(500);
			const logged = consoleError.mock.calls.flat().map(String);
			expect(logged).toHaveLength(1);
			expect(JSON.parse(logged[0] ?? '')).toMatchObject({ message: 'Better Auth request failed' });
			expect(logged[0]).not.toContain(parameter);
		}
	);

	it("logs Better Auth's own messages without query parameters", () => {
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

		auth.options.logger.log(
			'error',
			'Failed query: select 1 where email = $1\nparams: ada@example.com'
		);

		expect(JSON.parse(String(consoleError.mock.calls[0]?.[0]))).toMatchObject({
			message: 'Better Auth reported an error',
			detail: 'Failed query: select 1 where email = $1',
		});
	});

	it('logs the cause of an error a plugin passes inside an object', () => {
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

		auth.options.logger.log('error', 'CAPTCHA service unavailable', {
			endpoint: 'http://localhost:3000/api/auth/email-otp/send-verification-otp',
			message: new Error('CAPTCHA service unavailable', { cause: new Error('No OIDC token') }),
		});

		expect(JSON.parse(String(consoleError.mock.calls[0]?.[0]))).toMatchObject({
			message: 'Better Auth reported an error',
			err: { message: 'CAPTCHA service unavailable', cause: { message: 'No OIDC token' } },
		});
	});
});

describe('pruning expired sessions and verifications', () => {
	const past = new Date('2020-01-01T00:00:00Z');
	const future = new Date('2100-01-01T00:00:00Z');

	it('deletes every expired session and verification when a member signs in', async () => {
		await members.create({ email: 'ada@example.com', displayName: 'Ada', role: 'member' });
		const grace = await members.create({
			email: 'grace@example.com',
			displayName: 'Grace',
			role: 'member',
		});
		await db.insert(sessions).values([
			{ userId: grace.id, token: 'expired-session', expiresAt: past },
			{ userId: grace.id, token: 'live-session', expiresAt: future },
		]);
		await db.insert(verifications).values([
			{ identifier: 'expired-challenge', value: '{}', expiresAt: past },
			{ identifier: 'live-challenge', value: '{}', expiresAt: future },
		]);

		const response = await signIn('ada@example.com');
		const { token } = (await response.json()) as { token: string };
		await backgroundWork();

		const remainingSessions = await db.select({ token: sessions.token }).from(sessions);
		expect(remainingSessions.map((row) => row.token).toSorted()).toEqual(
			[token, 'live-session'].toSorted()
		);
		expect(await db.select({ identifier: verifications.identifier }).from(verifications)).toEqual([
			{ identifier: 'live-challenge' },
		]);
	});

	it('signs the member in and logs a warning when the deletion fails', async () => {
		await members.create({ email: 'ada@example.com', displayName: 'Ada', role: 'member' });
		await db.execute(sql`
			create function refuse_deletion() returns trigger language plpgsql
			as $$ begin raise exception 'deletion refused'; end $$
		`);
		await db.execute(sql`
			create trigger refuse_session_deletion before delete on sessions
			for each statement execute function refuse_deletion()
		`);
		const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

		const response = await signIn('ada@example.com');
		await backgroundWork();

		expect(response.status).toBe(200);
		const logged = consoleWarn.mock.calls.map(([line]) => JSON.parse(String(line)));
		expect(logged).toContainEqual(
			expect.objectContaining({
				message: 'Expired sessions and verifications could not be deleted',
				err: expect.objectContaining({
					// raise_exception, the code the trigger's refusal carries; its message stays out of logs.
					cause: expect.objectContaining({ code: 'P0001' }),
				}),
			})
		);
	});
});
