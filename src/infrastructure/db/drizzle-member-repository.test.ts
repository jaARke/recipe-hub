import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { eq, sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import type { NewMember } from '@/application/ports/member-repository';
import { describeMemberRepositoryContract } from '@/application/testing/member-repository-contract';
import { inviteExpiry, type InviteId } from '@/domain/member/invite';
import { memberIdSchema, removedMemberEmail, type MemberId } from '@/domain/member/member';
import { recipeContentSchema } from '@/domain/recipe/recipe';
import { sampleChickenSoup } from '@/domain/recipe/samples/sample-recipes';
import { createTestAuth, testHost } from '@/infrastructure/auth/testing/test-auth';
import { DrizzleFavoriteRepository } from '@/infrastructure/db/drizzle-favorite-repository';
import { DrizzleInviteRepository } from '@/infrastructure/db/drizzle-invite-repository';
import { DrizzleMemberRepository } from '@/infrastructure/db/drizzle-member-repository';
import { DrizzleRecipeRepository } from '@/infrastructure/db/drizzle-recipe-repository';
import { DrizzleSavedDraftRepository } from '@/infrastructure/db/drizzle-saved-draft-repository';
import {
	invites,
	passkeys,
	recipes,
	sessions,
	users,
	verifications,
} from '@/infrastructure/db/schema';
import { requireBoundedWrites } from '@/infrastructure/db/testing/bounded-writes';
import { createTestDatabase, type TestDatabase } from '@/infrastructure/db/testing/test-database';

const backdated = new Date('2026-01-01T00:00:00Z');

const freeRemovedMemberEmails = path.join(
	import.meta.dirname,
	'migrations/0008_free-removed-member-emails.sql'
);

const uuidV7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const ada: NewMember = { email: 'ada@example.com', displayName: 'Ada', role: 'member' };
const grace: NewMember = { email: 'grace@example.com', displayName: 'Grace', role: 'admin' };

let db: TestDatabase;
let repository: DrizzleMemberRepository;

beforeEach(async () => {
	db = await createTestDatabase();
	repository = new DrizzleMemberRepository(db);
});

afterEach(async () => {
	await db.$client.close();
});

async function backdate(id: MemberId) {
	await db
		.update(users)
		.set({ createdAt: backdated, updatedAt: backdated })
		.where(eq(users.id, id));
}

// Refuses any account created or role written without an advisory lock held, as an unserialized
// ensureAdmin would be.
async function requireEnsureAdminLock() {
	await db.execute(
		sql.raw(`create function require_ensure_admin_lock() returns trigger language plpgsql as $$
begin
	if not exists (
		select 1 from pg_locks where locktype = 'advisory' and pid = pg_backend_pid() and granted
	) then
		raise exception 'admin ensured without the lock';
	end if;
	return new;
end
$$`)
	);
	await db.execute(
		sql`create trigger require_ensure_admin_lock before insert or update of role on users for each row execute function require_ensure_admin_lock()`
	);
}

async function storedColumns(id: MemberId) {
	const [row] = await db
		.select({ emailVerified: users.emailVerified, updatedAt: users.updatedAt })
		.from(users)
		.where(eq(users.id, id));
	return row;
}

async function expectUpdatedAtMoved(id: MemberId) {
	expect((await storedColumns(id))?.updatedAt.getTime()).toBeGreaterThan(backdated.getTime());
}

// A session, a passkey, and a pending sign-in code, as Better Auth stores them for a member.
async function storeSignIn(id: MemberId, email: string) {
	const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
	await db.insert(sessions).values({ token: `token-${id}`, userId: id, expiresAt });
	await db.insert(passkeys).values({
		publicKey: 'public-key',
		userId: id,
		credentialID: `credential-${id}`,
		counter: 0,
		deviceType: 'multiDevice',
		backedUp: true,
	});
	await db
		.insert(verifications)
		.values({ identifier: `sign-in-otp-${email}`, value: 'encrypted-code:0', expiresAt });
}

async function signInRowCounts(id: MemberId, email: string) {
	return {
		sessions: await db.$count(sessions, eq(sessions.userId, id)),
		passkeys: await db.$count(passkeys, eq(passkeys.userId, id)),
		codes: await db.$count(verifications, eq(verifications.identifier, `sign-in-otp-${email}`)),
	};
}

describeMemberRepositoryContract(() => ({
	members: repository,
	invites: new DrizzleInviteRepository(db),
	favorites: new DrizzleFavoriteRepository(db),
	recipes: new DrizzleRecipeRepository(db),
	drafts: new DrizzleSavedDraftRepository(db),
}));

describe('create', () => {
	it('stores the email as verified, with a uuidv7 id', async () => {
		const created = await repository.create(ada);

		expect(created.id).toMatch(uuidV7);
		expect((await storedColumns(created.id))?.emailVerified).toBe(true);
	});
});

describe('list', () => {
	it('orders members created at the same moment by id', async () => {
		const first = await repository.create(ada);
		const second = await repository.create(grace);
		await backdate(first.id);
		await backdate(second.id);

		const listed = await repository.list();

		expect(listed.map(({ id }) => id)).toEqual([first.id, second.id]);
	});
});

describe('ensureAdmin', () => {
	it('stores the email of an account it creates as verified', async () => {
		const { member } = await repository.ensureAdmin({ email: ada.email, displayName: 'Admin' });

		expect((await storedColumns(member.id))?.emailVerified).toBe(true);
	});
});

describe('updatedAt', () => {
	it('moves when ensureAdmin makes the member an admin', async () => {
		const member = await repository.create(ada);
		await backdate(member.id);

		await repository.ensureAdmin({ email: ada.email, displayName: 'Admin' });

		await expectUpdatedAtMoved(member.id);
	});

	it('moves when the role changes', async () => {
		const member = await repository.create(ada);
		await backdate(member.id);

		await repository.setRole(member.id, 'admin');

		await expectUpdatedAtMoved(member.id);
	});

	it('moves when the member is removed', async () => {
		const member = await repository.create(ada);
		await backdate(member.id);

		await repository.remove(member.id);

		await expectUpdatedAtMoved(member.id);
	});

	it('moves when the member is renamed', async () => {
		const member = await repository.create(ada);
		await backdate(member.id);

		await repository.rename(member.id, 'Ada L.');

		await expectUpdatedAtMoved(member.id);
	});
});

// PGlite runs one transaction at a time, so these prove the lock that makes concurrent calls on
// Postgres take turns.
describe('ensureAdmin lock', () => {
	const owner = { email: 'owner@example.com', displayName: 'Admin' };

	it('holds the lock while it creates the account', async () => {
		await requireEnsureAdminLock();

		expect(await repository.ensureAdmin(owner)).toMatchObject({ outcome: 'created' });
	});

	it('holds the lock while it makes a member an admin', async () => {
		await repository.create({ ...ada, email: owner.email });
		await requireEnsureAdminLock();

		expect(await repository.ensureAdmin(owner)).toMatchObject({ outcome: 'promoted' });
	});

	it('is checked here by a trigger that refuses an account or role written without the lock', async () => {
		const member = await repository.create(ada);
		await requireEnsureAdminLock();
		const refused = expect.objectContaining({
			cause: expect.objectContaining({ message: 'admin ensured without the lock' }),
		});

		await expect(repository.create(grace)).rejects.toThrow(refused);
		await expect(
			db.update(users).set({ role: 'admin' }).where(eq(users.id, member.id))
		).rejects.toThrow(refused);
	});
});

describe('bounded writes', () => {
	const owner = { email: 'owner@example.com', displayName: 'Admin' };

	it('ensures the admin account in a bounded transaction', async () => {
		await requireBoundedWrites(db, 'users');

		expect(await repository.ensureAdmin(owner)).toMatchObject({ outcome: 'created' });
	});

	it('removes a member in a bounded transaction', async () => {
		const member = await repository.create(ada);
		await requireBoundedWrites(db, 'users');

		expect(await repository.remove(member.id)).toMatchObject({ id: member.id });
	});
});

describe('remove', () => {
	it('keeps the recipes that name the member', async () => {
		const member = await repository.create(ada);
		const content = recipeContentSchema.parse(sampleChickenSoup);
		await new DrizzleRecipeRepository(db).create({
			content,
			provenance: { entryMode: 'manual' },
			contributorId: member.id,
			slugBase: 'chicken-soup',
		});

		await repository.remove(member.id);

		expect(await db.$count(recipes, eq(recipes.contributorId, member.id))).toBe(1);
	});

	it("ends the member's sessions and deletes their passkeys and sign-in code", async () => {
		const member = await repository.create(ada);
		const other = await repository.create(grace);
		await storeSignIn(member.id, ada.email);
		await storeSignIn(other.id, grace.email);

		await repository.remove(member.id);

		expect(await signInRowCounts(member.id, ada.email)).toEqual({
			sessions: 0,
			passkeys: 0,
			codes: 0,
		});
		expect(await signInRowCounts(other.id, grace.email)).toEqual({
			sessions: 1,
			passkeys: 1,
			codes: 1,
		});
	});

	it('deletes a code Better Auth sent before the removal, so it no longer signs them in', async () => {
		const { auth } = createTestAuth(db);
		const member = await repository.create(ada);
		await repository.create(grace);
		const headers = new Headers({ host: testHost });
		const codeFor = (email: string) =>
			auth.api.createVerificationOTP({ body: { email, type: 'sign-in' }, headers });
		const removedCode = await codeFor(ada.email);
		const keptCode = await codeFor(grace.email);

		await repository.remove(member.id);

		await expect(
			auth.api.signInEmailOTP({ body: { email: ada.email, otp: removedCode }, headers })
		).rejects.toMatchObject({ body: { code: 'INVALID_OTP' } });
		expect(await db.$count(sessions, eq(sessions.userId, member.id))).toBe(0);
		await expect(
			auth.api.signInEmailOTP({ body: { email: grace.email, otp: keptCode }, headers })
		).resolves.toMatchObject({ user: { email: grace.email } });
	});
});

describe('migration 0008', () => {
	// The owner's account as the migration finds it: removed while still holding its address.
	async function insertRemovedOwner(inviteId?: InviteId): Promise<MemberId> {
		const [row] = await db
			.insert(users)
			.values({
				displayName: 'Olive',
				email: 'owner@example.com',
				emailVerified: true,
				role: 'admin',
				removedAt: backdated,
				inviteId,
			})
			.returning({ id: users.id });
		return memberIdSchema.parse(row?.id);
	}

	// The file as one script: PGlite prepares what db.execute sends, and a prepared statement holds one.
	async function runMigration() {
		await db.$client.exec(await readFile(freeRemovedMemberEmails, 'utf8'));
	}

	async function storedRevokedAt(id: InviteId) {
		const [row] = await db
			.select({ revokedAt: invites.revokedAt })
			.from(invites)
			.where(eq(invites.id, id));
		return row?.revokedAt;
	}

	it('frees the address of an account removed with it, so ensureAdmin creates a new account', async () => {
		const removedId = await insertRemovedOwner();
		const member = await repository.create(ada);

		await runMigration();
		const ensured = await repository.ensureAdmin({
			email: 'owner@example.com',
			displayName: 'Admin',
		});

		expect(await repository.findById(removedId)).toMatchObject({
			email: removedMemberEmail(removedId),
			removedAt: backdated,
		});
		expect(await repository.findById(member.id)).toEqual(member);
		expect(ensured).toMatchObject({ member: { email: 'owner@example.com' }, outcome: 'created' });
		expect(ensured.member.id).not.toBe(removedId);
	});

	it("revokes the open invites bound to a removed account's address, and no others", async () => {
		const admin = await repository.create(grace);
		const invitesRepository = new DrizzleInviteRepository(db);
		const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
		const issue = async (email: string, issuedAt = new Date()) => {
			const invite = await invitesRepository.create({
				tokenHash: randomBytes(32).toString('hex'),
				displayName: 'Olive',
				role: 'member',
				createdBy: admin.id,
				expiresAt: inviteExpiry(issuedAt),
			});
			await invitesRepository.bindEmail(invite.id, email, issuedAt);
			return invite.id;
		};
		const open = await issue('owner@example.com');
		const accepted = await issue('owner@example.com');
		const revoked = await issue('owner@example.com');
		await invitesRepository.revoke(revoked, hourAgo);
		const expired = await issue('owner@example.com', backdated);
		const elsewhere = await issue('lin@example.com');
		await insertRemovedOwner(accepted);
		const migratedFrom = new Date();

		await runMigration();

		expect((await storedRevokedAt(open))?.getTime()).toBeGreaterThanOrEqual(migratedFrom.getTime());
		expect(await storedRevokedAt(accepted)).toBeNull();
		expect(await storedRevokedAt(revoked)).toEqual(hourAgo);
		expect(await storedRevokedAt(expired)).toBeNull();
		expect(await storedRevokedAt(elsewhere)).toBeNull();
	});
});

describe('reading stored rows', () => {
	it('throws when a stored display name is blank', async () => {
		// Better Auth stores a blank name when nothing names the account it creates.
		const created = await repository.create(ada);
		await db.update(users).set({ displayName: '' }).where(eq(users.id, created.id));

		await expect(repository.findById(created.id)).rejects.toThrow(ZodError);
	});
});
