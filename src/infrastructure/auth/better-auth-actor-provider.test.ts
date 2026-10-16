import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InviteService } from '@/application/access/invite-service';
import type { ActorProvider } from '@/application/ports/actor-provider';
import type { NewMember } from '@/application/ports/member-repository';
import { actorFor } from '@/application/testing/actors';
import { FixedActorProvider } from '@/application/testing/fixed-actor-provider';
import { InMemoryEmailSender } from '@/application/testing/in-memory-email-sender';
import type { Auth } from '@/infrastructure/auth/better-auth';
import { BetterAuthActorProvider } from '@/infrastructure/auth/better-auth-actor-provider';
import {
	cookiesFrom,
	createTestAuth,
	testHost,
	testOrigin,
} from '@/infrastructure/auth/testing/test-auth';
import { DrizzleAccessRequestRepository } from '@/infrastructure/db/drizzle-access-request-repository';
import { DrizzleInviteRepository } from '@/infrastructure/db/drizzle-invite-repository';
import { DrizzleMemberRepository } from '@/infrastructure/db/drizzle-member-repository';
import { sessions, users } from '@/infrastructure/db/schema';
import { createTestDatabase, type TestDatabase } from '@/infrastructure/db/testing/test-database';

const day = 24 * 60 * 60 * 1000;

const jake: NewMember = { email: 'jake@example.com', displayName: 'Jake', role: 'admin' };
const ada: NewMember = { email: 'ada@example.com', displayName: 'Ada', role: 'member' };

let db: TestDatabase;
let members: DrizzleMemberRepository;
let auth: Auth;

beforeEach(async () => {
	db = await createTestDatabase();
	members = new DrizzleMemberRepository(db);
	({ auth } = createTestAuth(db));
});

afterEach(async () => {
	await db.$client.close();
});

function providerFor(requestHeaders: Headers): BetterAuthActorProvider {
	return new BetterAuthActorProvider(
		() => auth,
		async () => requestHeaders
	);
}

// The request headers of a browser signed in as the member, skipping the emailed code.
async function signedInHeaders(email: string): Promise<Headers> {
	const otp = await auth.api.createVerificationOTP({
		body: { email, type: 'sign-in' },
		headers: new Headers({ host: testHost }),
	});
	const { headers } = await auth.api.signInEmailOTP({
		body: { email, otp },
		headers: new Headers({ host: testHost }),
		returnHeaders: true,
	});
	return new Headers({ host: testHost, cookie: cookiesFrom(headers) });
}

async function sessionExpiry(): Promise<Date | undefined> {
	const [row] = await db.select({ expiresAt: sessions.expiresAt }).from(sessions);
	return row?.expiresAt;
}

async function sessionStart(): Promise<Date | undefined> {
	const [row] = await db.select({ createdAt: sessions.createdAt }).from(sessions);
	return row?.createdAt;
}

function inviteServiceFor(actors: ActorProvider): InviteService {
	return new InviteService(
		new DrizzleInviteRepository(db),
		new DrizzleAccessRequestRepository(db),
		members,
		new InMemoryEmailSender(),
		actors,
		new URL(testOrigin)
	);
}

describe('currentActor', () => {
	it("returns the signed-in member with their role and their session's start", async () => {
		const member = await members.create(jake);

		const actor = await providerFor(await signedInHeaders(jake.email)).currentActor();

		expect(actor).toEqual({
			kind: 'member',
			memberId: member.id,
			role: 'admin',
			sessionStartedAt: await sessionStart(),
		});
	});

	it("starts a sign-up's session close enough to its account that the invite reports it new", async () => {
		const admin = inviteServiceFor(new FixedActorProvider(actorFor(await members.create(jake))));
		const issued = await admin.issueInvite({ displayName: ada.displayName });
		const token = new URL(issued.link).hash.slice(1);
		await admin.bindInviteEmail(token, ada.email);

		// The first code for the invited address creates the account.
		const headers = await signedInHeaders(ada.email);

		expect(await inviteServiceFor(providerFor(headers)).completeInvite(token)).toEqual({
			account: 'created',
		});
	});

	it('returns an anonymous actor without a session', async () => {
		const actor = await providerFor(new Headers({ host: testHost })).currentActor();

		expect(actor).toEqual({ kind: 'anonymous' });
	});

	it('returns an anonymous actor once the signed-in member is removed', async () => {
		const member = await members.create(ada);
		const headers = await signedInHeaders(ada.email);

		await members.remove(member.id);

		expect(await providerFor(headers).currentActor()).toEqual({ kind: 'anonymous' });
	});

	it("returns an anonymous actor for a session that outlived its member's removal", async () => {
		const member = await members.create(ada);
		const headers = await signedInHeaders(ada.email);

		// What a sign-in finishing during the removal leaves: the member marked removed, the session kept.
		await db.update(users).set({ removedAt: new Date() }).where(eq(users.id, member.id));

		expect(await providerFor(headers).currentActor()).toEqual({ kind: 'anonymous' });
	});

	it('reads the request before building Better Auth', async () => {
		let built = false;
		// A prerender's request never resolves.
		const provider = new BetterAuthActorProvider(
			() => {
				built = true;
				return auth;
			},
			() => new Promise<Headers>(() => {})
		);

		void provider.currentActor();
		await Promise.resolve();

		expect(built).toBe(false);
	});

	it('reads a session due for renewal without extending it', async () => {
		await members.create(jake);
		const headers = await signedInHeaders(jake.email);
		// Signed in two days ago: past the daily renewal age.
		const dueForRenewal = new Date(Date.now() + 178 * day);
		await db.update(sessions).set({ expiresAt: dueForRenewal });

		await providerFor(headers).currentActor();
		const afterProviderRead = await sessionExpiry();
		await auth.api.getSession({ headers });
		const afterRenewingRead = await sessionExpiry();

		expect(afterProviderRead).toEqual(dueForRenewal);
		expect(afterRenewingRead?.getTime()).toBeGreaterThan(dueForRenewal.getTime());
	});
});
