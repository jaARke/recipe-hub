import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { NewInvite } from '@/application/ports/invite-repository';
import {
	inviteExpiry,
	inviteIdSchema,
	inviteStatus,
	type Invite,
	type InviteId,
} from '@/domain/member/invite';
import { memberIdSchema, type MemberId } from '@/domain/member/member';
import { DrizzleAccessRequestRepository } from '@/infrastructure/db/drizzle-access-request-repository';
import { DrizzleInviteRepository } from '@/infrastructure/db/drizzle-invite-repository';
import { DrizzleMemberRepository } from '@/infrastructure/db/drizzle-member-repository';
import { invites, users } from '@/infrastructure/db/schema';
import { createTestDatabase, type TestDatabase } from '@/infrastructure/db/testing/test-database';

const missingId = inviteIdSchema.parse('0199c7a4-2c3e-7b1a-9f00-2a7c1e4b5d6e');
const issuedAt = new Date('2026-10-12T12:00:00Z');
const now = new Date('2026-10-14T12:00:00Z');
const backdated = new Date('2026-01-01T00:00:00Z');

const uuidV7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

let db: TestDatabase;
let repository: DrizzleInviteRepository;
let adminId: MemberId;

beforeEach(async () => {
	db = await createTestDatabase();
	repository = new DrizzleInviteRepository(db);
	const admin = await new DrizzleMemberRepository(db).create({
		email: 'admin@example.com',
		displayName: 'Admin',
		role: 'admin',
	});
	adminId = admin.id;
});

afterEach(async () => {
	await db.$client.close();
});

function newInvite(overrides: Partial<NewInvite> = {}): NewInvite {
	return {
		tokenHash: randomBytes(32).toString('hex'),
		displayName: 'Grace',
		role: 'member',
		createdBy: adminId,
		expiresAt: inviteExpiry(issuedAt),
		...overrides,
	};
}

// What Better Auth stores when the invitee confirms their code.
async function accept(invite: Invite, email: string): Promise<MemberId> {
	const [row] = await db
		.insert(users)
		.values({
			displayName: invite.displayName,
			email,
			emailVerified: true,
			role: invite.role,
			inviteId: invite.id,
		})
		.returning({ id: users.id });
	return memberIdSchema.parse(row?.id);
}

// An open invite bound to the address, plus one accepted, one revoked, and one expired.
async function createInvitesInEveryStatus(email: string) {
	const open = await repository.create(newInvite());
	await repository.bindEmail(open.id, email, now);
	const accepted = await repository.create(newInvite());
	await repository.bindEmail(accepted.id, email, now);
	await accept(accepted, email);
	const revoked = await repository.create(newInvite());
	await repository.bindEmail(revoked.id, email, now);
	await repository.revoke(revoked.id, now);
	const expired = await repository.create(newInvite({ expiresAt: now }));
	await repository.bindEmail(expired.id, email, issuedAt);
	return { open, accepted, revoked, expired };
}

async function backdate(id: InviteId) {
	await db.update(invites).set({ createdAt: backdated }).where(eq(invites.id, id));
}

describe('create', () => {
	it('stores the invite and reads it back by its token hash', async () => {
		const request = await new DrizzleAccessRequestRepository(db).create({
			name: 'Grace',
			relationship: "Lou's old coworker",
		});
		const invite = newInvite({ requestId: request.id });

		const created = await repository.create(invite);

		expect(created).toEqual({
			id: expect.stringMatching(uuidV7),
			requestId: request.id,
			displayName: 'Grace',
			role: 'member',
			createdBy: adminId,
			createdAt: expect.any(Date),
			expiresAt: invite.expiresAt,
		});
		expect(await repository.findByTokenHash(invite.tokenHash)).toEqual(created);
	});

	it('leaves out what a new direct invite does not have yet', async () => {
		const created = await repository.create(newInvite());

		for (const field of ['requestId', 'email', 'revokedAt', 'acceptedBy']) {
			expect(created).not.toHaveProperty(field);
		}
		expect(inviteStatus(created, now)).toBe('open');
	});
});

describe('findByTokenHash', () => {
	it('finds invites that are no longer open, with what closed them', async () => {
		const tokenHashes = {
			accepted: randomBytes(32).toString('hex'),
			revoked: randomBytes(32).toString('hex'),
			expired: randomBytes(32).toString('hex'),
		};
		const accepted = await repository.create(newInvite({ tokenHash: tokenHashes.accepted }));
		const memberId = await accept(accepted, 'grace@example.com');
		const revoked = await repository.create(newInvite({ tokenHash: tokenHashes.revoked }));
		await repository.revoke(revoked.id, now);
		await repository.create(newInvite({ tokenHash: tokenHashes.expired, expiresAt: now }));

		const found = {
			accepted: await repository.findByTokenHash(tokenHashes.accepted),
			revoked: await repository.findByTokenHash(tokenHashes.revoked),
			expired: await repository.findByTokenHash(tokenHashes.expired),
		};

		expect(found.accepted).toEqual({ ...accepted, acceptedBy: memberId });
		expect(found.revoked).toEqual({ ...revoked, revokedAt: now });
		expect(
			[found.accepted, found.revoked, found.expired].map(
				(invite) => invite && inviteStatus(invite, now)
			)
		).toEqual(['accepted', 'revoked', 'expired']);
	});

	it('returns null when no invite has the hash', async () => {
		await repository.create(newInvite());

		expect(await repository.findByTokenHash(randomBytes(32).toString('hex'))).toBeNull();
	});
});

describe('findOpenByEmail', () => {
	it('finds the newest open invite bound to the address', async () => {
		const older = await repository.create(newInvite());
		const newer = await repository.create(newInvite({ displayName: 'Grace H.' }));
		await repository.bindEmail(older.id, 'grace@example.com', now);
		await repository.bindEmail(newer.id, 'grace@example.com', now);

		const found = await repository.findOpenByEmail('grace@example.com', now);

		expect(found).toEqual({ ...newer, email: 'grace@example.com' });
	});

	it('skips accepted, revoked, and expired invites', async () => {
		const { open } = await createInvitesInEveryStatus('grace@example.com');

		expect((await repository.findOpenByEmail('grace@example.com', now))?.id).toBe(open.id);
	});

	it('returns null when no open invite is bound to the address', async () => {
		await createInvitesInEveryStatus('grace@example.com');
		await repository.create(newInvite());

		expect(await repository.findOpenByEmail('ada@example.com', now)).toBeNull();
	});
});

describe('listOpen', () => {
	it('lists open invites newest first', async () => {
		const { open } = await createInvitesInEveryStatus('grace@example.com');
		const unbound = await repository.create(newInvite({ displayName: 'Ada' }));

		const listed = await repository.listOpen(now);

		expect(listed).toEqual([unbound, { ...open, email: 'grace@example.com' }]);
	});

	it('orders invites issued at the same moment by id', async () => {
		const first = await repository.create(newInvite());
		const second = await repository.create(newInvite());
		await backdate(first.id);
		await backdate(second.id);

		const listed = await repository.listOpen(now);

		expect(listed.map(({ id }) => id)).toEqual([second.id, first.id]);
	});

	it('treats an invite as expired from the moment it expires', async () => {
		const invite = await repository.create(newInvite({ expiresAt: now }));

		expect(await repository.listOpen(new Date(now.getTime() - 1))).toEqual([invite]);
		expect(await repository.listOpen(now)).toEqual([]);
	});
});

describe('bindEmail', () => {
	it('binds the address to an open invite', async () => {
		const created = await repository.create(newInvite());

		const bound = await repository.bindEmail(created.id, 'grace@example.com', now);

		expect(bound).toEqual({ ...created, email: 'grace@example.com' });
		expect(await repository.findOpenByEmail('grace@example.com', now)).toEqual(bound);
	});

	it('replaces an address bound earlier', async () => {
		const created = await repository.create(newInvite());
		await repository.bindEmail(created.id, 'grace@example.org', now);

		const bound = await repository.bindEmail(created.id, 'grace@example.com', now);

		expect(bound?.email).toBe('grace@example.com');
		expect(await repository.findOpenByEmail('grace@example.org', now)).toBeNull();
	});

	it('returns null when no open invite has the id', async () => {
		const { accepted, revoked, expired } = await createInvitesInEveryStatus('grace@example.com');

		for (const invite of [accepted, revoked, expired]) {
			expect(await repository.bindEmail(invite.id, 'ada@example.com', now)).toBeNull();
		}
		expect(await repository.bindEmail(missingId, 'ada@example.com', now)).toBeNull();

		const emails = await db.select({ email: invites.email }).from(invites);
		expect(emails.map(({ email }) => email)).not.toContain('ada@example.com');
	});
});

describe('revoke', () => {
	it('revokes an open invite at the given time', async () => {
		const created = await repository.create(newInvite());

		expect(await repository.revoke(created.id, now)).toBe(true);

		const [row] = await db
			.select({ revokedAt: invites.revokedAt })
			.from(invites)
			.where(eq(invites.id, created.id));
		expect(row?.revokedAt).toEqual(now);
		expect(await repository.listOpen(now)).toEqual([]);
	});

	it('returns false when no open invite has the id', async () => {
		const { accepted, revoked, expired } = await createInvitesInEveryStatus('grace@example.com');
		const later = new Date(now.getTime() + 60_000);

		for (const invite of [accepted, revoked, expired]) {
			expect(await repository.revoke(invite.id, later)).toBe(false);
		}
		expect(await repository.revoke(missingId, later)).toBe(false);

		const revokedTimes = await db.select({ revokedAt: invites.revokedAt }).from(invites);
		expect(revokedTimes.filter(({ revokedAt }) => revokedAt !== null)).toEqual([
			{ revokedAt: now },
		]);
	});
});

describe('acceptance', () => {
	it('refuses a second account for one invite', async () => {
		const invite = await repository.create(newInvite());
		await accept(invite, 'grace@example.com');

		await expect(accept(invite, 'grace@example.org')).rejects.toThrow(
			expect.objectContaining({
				cause: expect.objectContaining({ constraint: 'users_invite_id_unique' }),
			})
		);
	});
});
