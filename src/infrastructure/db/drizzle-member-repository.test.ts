import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import type { NewMember } from '@/application/ports/member-repository';
import { memberIdSchema, type MemberId } from '@/domain/member/member';
import { DrizzleMemberRepository } from '@/infrastructure/db/drizzle-member-repository';
import { users } from '@/infrastructure/db/schema';
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

async function storedColumns(id: MemberId) {
	const [row] = await db
		.select({ emailVerified: users.emailVerified, updatedAt: users.updatedAt })
		.from(users)
		.where(eq(users.id, id));
	return row;
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
});

describe('reading stored rows', () => {
	it('throws when a stored display name is blank', async () => {
		// Better Auth stores a blank name when nothing names the account it creates.
		const created = await repository.create(ada);
		await db.update(users).set({ displayName: '' }).where(eq(users.id, created.id));

		await expect(repository.findById(created.id)).rejects.toThrow(ZodError);
	});
});
