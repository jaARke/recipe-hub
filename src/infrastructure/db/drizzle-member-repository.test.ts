import { eq, sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { LastAdminError, MemberRoleConflictError } from '@/application/members/errors';
import type { NewMember } from '@/application/ports/member-repository';
import { memberIdSchema, type MemberId } from '@/domain/member/member';
import { recipeContentSchema } from '@/domain/recipe/recipe';
import { sampleChickenSoup } from '@/domain/recipe/samples/sample-recipes';
import { createTestAuth, testHost } from '@/infrastructure/auth/testing/test-auth';
import { DrizzleMemberRepository } from '@/infrastructure/db/drizzle-member-repository';
import { DrizzleRecipeRepository } from '@/infrastructure/db/drizzle-recipe-repository';
import { passkeys, recipes, sessions, users, verifications } from '@/infrastructure/db/schema';
import { createTestDatabase, type TestDatabase } from '@/infrastructure/db/testing/test-database';

const missingId = memberIdSchema.parse('0199c7a4-2c3e-7b1a-9f00-2a7c1e4b5d6e');
const backdated = new Date('2026-01-01T00:00:00Z');

const uuidV7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const ada: NewMember = { email: 'ada@example.com', displayName: 'Ada', role: 'member' };
const grace: NewMember = { email: 'grace@example.com', displayName: 'Grace', role: 'admin' };
const lin: NewMember = { email: 'lin@example.com', displayName: 'Lin', role: 'admin' };

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

// Refuses any role or removal written without an advisory lock held, as an unserialized one would be.
async function requireRoleLock() {
	await db.execute(
		sql.raw(`create function require_role_lock() returns trigger language plpgsql as $$
begin
	if not exists (
		select 1 from pg_locks where locktype = 'advisory' and pid = pg_backend_pid() and granted
	) then
		raise exception 'role written without the role lock';
	end if;
	return new;
end
$$`)
	);
	await db.execute(
		sql`create trigger require_role_lock before update of role, removed_at on users for each row execute function require_role_lock()`
	);
}

async function storedColumns(id: MemberId) {
	const [row] = await db
		.select({ emailVerified: users.emailVerified, updatedAt: users.updatedAt })
		.from(users)
		.where(eq(users.id, id));
	return row;
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

describe('create', () => {
	it('stores the member and reads it back', async () => {
		const created = await repository.create(ada);

		expect(created).toEqual({
			...ada,
			id: expect.stringMatching(uuidV7),
			createdAt: expect.any(Date),
		});
		expect(await repository.findById(created.id)).toEqual(created);
	});

	it('stores the email as verified', async () => {
		const created = await repository.create(ada);

		expect((await storedColumns(created.id))?.emailVerified).toBe(true);
	});
});

describe('findById and findByEmail', () => {
	it('find a stored member', async () => {
		const created = await repository.create(ada);

		expect(await repository.findById(created.id)).toEqual(created);
		expect(await repository.findByEmail('ada@example.com')).toEqual(created);
	});

	it('return null when nothing matches', async () => {
		await repository.create(ada);

		expect(await repository.findById(missingId)).toBeNull();
		expect(await repository.findByEmail('grace@example.com')).toBeNull();
	});

	it('compare addresses exactly, since callers lowercase them', async () => {
		await repository.create(ada);

		expect(await repository.findByEmail('Ada@Example.com')).toBeNull();
	});
});

describe('list', () => {
	it('lists every member oldest first', async () => {
		const created = [];
		for (const member of [ada, grace, lin]) {
			created.push(await repository.create(member));
		}

		expect(await repository.list()).toEqual(created);
	});

	it('orders members created at the same moment by id', async () => {
		const first = await repository.create(ada);
		const second = await repository.create(grace);
		await backdate(first.id);
		await backdate(second.id);

		const listed = await repository.list();

		expect(listed.map(({ id }) => id)).toEqual([first.id, second.id]);
	});
});

describe('listAdmins', () => {
	it('lists only admins, oldest first', async () => {
		await repository.create(ada);
		const firstAdmin = await repository.create(grace);
		const secondAdmin = await repository.create(lin);

		expect(await repository.listAdmins()).toEqual([firstAdmin, secondAdmin]);
	});
});

describe('setRole', () => {
	it('changes the role and moves updatedAt', async () => {
		const created = await repository.create(ada);
		await backdate(created.id);

		const updated = await repository.setRole(created.id, 'admin');

		expect(updated).toEqual({ ...created, role: 'admin', createdAt: backdated });
		expect(await repository.findById(created.id)).toEqual(updated);
		expect((await storedColumns(created.id))?.updatedAt.getTime()).toBeGreaterThan(
			backdated.getTime()
		);
	});

	it('returns null when no member has the id', async () => {
		expect(await repository.setRole(missingId, 'admin')).toBeNull();
	});

	it('returns null for a removed member', async () => {
		const member = await repository.create(ada);
		await repository.remove(member.id);

		expect(await repository.setRole(member.id, 'admin')).toBeNull();
	});

	it('refuses a role the member already has', async () => {
		const member = await repository.create(ada);
		const admin = await repository.create(grace);

		await expect(repository.setRole(member.id, 'member')).rejects.toThrow(MemberRoleConflictError);
		await expect(repository.setRole(admin.id, 'admin')).rejects.toThrow(MemberRoleConflictError);
	});

	it('removes admin while another admin remains', async () => {
		const first = await repository.create(grace);
		const second = await repository.create(lin);

		expect(await repository.setRole(first.id, 'member')).toEqual({ ...first, role: 'member' });
		expect(await repository.listAdmins()).toEqual([second]);
	});

	it('refuses to remove the only admin and keeps them an admin', async () => {
		await repository.create(ada);
		const admin = await repository.create(grace);

		await expect(repository.setRole(admin.id, 'member')).rejects.toThrow(LastAdminError);
		expect(await repository.listAdmins()).toEqual([admin]);
	});

	it('counts only admins who are not removed', async () => {
		const admin = await repository.create(grace);
		const removedAdmin = await repository.create(lin);
		await repository.remove(removedAdmin.id);

		await expect(repository.setRole(admin.id, 'member')).rejects.toThrow(LastAdminError);
	});

	it('keeps one admin when two admins remove each other at once', async () => {
		const first = await repository.create(grace);
		const second = await repository.create(lin);

		const results = await Promise.allSettled([
			repository.setRole(first.id, 'member'),
			repository.setRole(second.id, 'member'),
		]);

		expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
		expect(results.filter(({ status }) => status === 'rejected')).toEqual([
			{ status: 'rejected', reason: expect.any(LastAdminError) },
		]);
		expect(await repository.listAdmins()).toHaveLength(1);
	});
});

// PGlite runs one transaction at a time, so these prove the lock that makes concurrent changes on
// Postgres take turns.
describe('role lock', () => {
	it('holds the role lock while it writes a role', async () => {
		const member = await repository.create(ada);
		const admin = await repository.create(grace);
		await requireRoleLock();

		expect(await repository.setRole(member.id, 'admin')).toMatchObject({ role: 'admin' });
		expect(await repository.setRole(admin.id, 'member')).toMatchObject({ role: 'member' });
	});

	it('holds the role lock while it removes a member', async () => {
		const member = await repository.create(ada);
		await requireRoleLock();

		expect(await repository.remove(member.id)).toMatchObject({ removedAt: expect.any(Date) });
	});

	it('is checked here by a trigger that refuses a role or removal written without the lock', async () => {
		const member = await repository.create(ada);
		await requireRoleLock();
		const refused = expect.objectContaining({
			cause: expect.objectContaining({ message: 'role written without the role lock' }),
		});

		await expect(
			db.update(users).set({ role: 'admin' }).where(eq(users.id, member.id))
		).rejects.toThrow(refused);
		await expect(
			db.update(users).set({ removedAt: new Date() }).where(eq(users.id, member.id))
		).rejects.toThrow(refused);
	});
});

describe('remove', () => {
	it('marks the member removed and moves updatedAt', async () => {
		const created = await repository.create(ada);
		await backdate(created.id);

		const removed = await repository.remove(created.id);

		expect(removed).toEqual({ ...created, createdAt: backdated, removedAt: expect.any(Date) });
		expect((await storedColumns(created.id))?.updatedAt.getTime()).toBeGreaterThan(
			backdated.getTime()
		);
	});

	it('keeps the member findable by id and address, with the recipes that name them', async () => {
		const member = await repository.create(ada);
		const content = recipeContentSchema.parse(sampleChickenSoup);
		await new DrizzleRecipeRepository(db).create({
			content,
			provenance: { entryMode: 'manual' },
			contributorId: member.id,
			slugBase: 'chicken-soup',
		});

		const removed = await repository.remove(member.id);

		expect(await repository.findById(member.id)).toEqual(removed);
		expect(await repository.findByEmail(ada.email)).toEqual(removed);
		expect(await db.$count(recipes, eq(recipes.contributorId, member.id))).toBe(1);
	});

	it('leaves the member out of the lists', async () => {
		const member = await repository.create(ada);
		const admin = await repository.create(grace);
		const removedAdmin = await repository.create(lin);

		await repository.remove(member.id);
		await repository.remove(removedAdmin.id);

		expect(await repository.list()).toEqual([admin]);
		expect(await repository.listAdmins()).toEqual([admin]);
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

	it('returns null when no member has the id, or the member was removed already', async () => {
		const member = await repository.create(ada);
		await repository.remove(member.id);

		expect(await repository.remove(missingId)).toBeNull();
		expect(await repository.remove(member.id)).toBeNull();
	});

	it('removes an admin while another admin remains', async () => {
		const first = await repository.create(grace);
		const second = await repository.create(lin);

		expect(await repository.remove(first.id)).toMatchObject({ role: 'admin' });
		expect(await repository.listAdmins()).toEqual([second]);
	});

	it('refuses to remove the only admin and keeps them', async () => {
		await repository.create(ada);
		const admin = await repository.create(grace);
		await storeSignIn(admin.id, grace.email);

		await expect(repository.remove(admin.id)).rejects.toThrow(LastAdminError);
		expect(await repository.listAdmins()).toEqual([admin]);
		expect(await signInRowCounts(admin.id, grace.email)).toEqual({
			sessions: 1,
			passkeys: 1,
			codes: 1,
		});
	});

	it('keeps one admin when an admin is removed as they remove admin from the other', async () => {
		const first = await repository.create(grace);
		const second = await repository.create(lin);

		const results = await Promise.allSettled([
			repository.remove(first.id),
			repository.setRole(second.id, 'member'),
		]);

		expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
		expect(results.filter(({ status }) => status === 'rejected')).toEqual([
			{ status: 'rejected', reason: expect.any(LastAdminError) },
		]);
		expect(await repository.listAdmins()).toHaveLength(1);
	});
});

describe('rename', () => {
	it('changes the display name and moves updatedAt', async () => {
		const created = await repository.create(ada);
		await backdate(created.id);

		const renamed = await repository.rename(created.id, 'Ada L.');

		expect(renamed).toEqual({ ...created, displayName: 'Ada L.', createdAt: backdated });
		expect(await repository.findById(created.id)).toEqual(renamed);
		expect((await storedColumns(created.id))?.updatedAt.getTime()).toBeGreaterThan(
			backdated.getTime()
		);
	});

	it('returns null when no member has the id', async () => {
		expect(await repository.rename(missingId, 'Ada L.')).toBeNull();
	});

	it('returns null for a removed member', async () => {
		const member = await repository.create(ada);
		await repository.remove(member.id);

		expect(await repository.rename(member.id, 'Ada L.')).toBeNull();
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
