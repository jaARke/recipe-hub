import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	accessRequestIdSchema,
	type AccessRequestFields,
	type AccessRequestId,
} from '@/domain/member/access-request';
import { DrizzleAccessRequestRepository } from '@/infrastructure/db/drizzle-access-request-repository';
import { accessRequests } from '@/infrastructure/db/schema';
import { createTestDatabase, type TestDatabase } from '@/infrastructure/db/testing/test-database';

const missingId = accessRequestIdSchema.parse('0199c7a4-2c3e-7b1a-9f00-2a7c1e4b5d6e');
const backdated = new Date('2026-01-01T00:00:00Z');

const uuidV7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const fromAda: AccessRequestFields = {
	name: 'Ada',
	relationship: "June's neighbor on Maple Street",
	email: 'ada@example.com',
};
const fromGrace: AccessRequestFields = { name: 'Grace', relationship: "Lou's old coworker" };
const fromLin: AccessRequestFields = { name: 'Lin', relationship: 'A friend from the choir' };

let db: TestDatabase;
let repository: DrizzleAccessRequestRepository;

beforeEach(async () => {
	db = await createTestDatabase();
	repository = new DrizzleAccessRequestRepository(db);
});

afterEach(async () => {
	await db.$client.close();
});

async function backdate(id: AccessRequestId) {
	await db.update(accessRequests).set({ createdAt: backdated }).where(eq(accessRequests.id, id));
}

describe('create', () => {
	it('stores a pending request and reads it back', async () => {
		const created = await repository.create(fromAda);

		expect(created).toEqual({
			...fromAda,
			id: expect.stringMatching(uuidV7),
			status: 'pending',
			createdAt: expect.any(Date),
		});
		expect(await repository.findById(created.id)).toEqual(created);
	});

	it('leaves out an email the request did not give', async () => {
		const created = await repository.create(fromGrace);

		expect(created).not.toHaveProperty('email');
		expect(await repository.findById(created.id)).not.toHaveProperty('email');
	});
});

describe('findById', () => {
	it('returns null when no request has the id', async () => {
		await repository.create(fromAda);

		expect(await repository.findById(missingId)).toBeNull();
	});
});

describe('listPending', () => {
	it('lists pending requests oldest first', async () => {
		const first = await repository.create(fromAda);
		const approved = await repository.create(fromGrace);
		const third = await repository.create(fromLin);
		await repository.markApproved(approved.id);

		expect(await repository.listPending()).toEqual([first, third]);
	});

	it('orders requests made at the same moment by id', async () => {
		const first = await repository.create(fromAda);
		const second = await repository.create(fromGrace);
		await backdate(first.id);
		await backdate(second.id);

		const listed = await repository.listPending();

		expect(listed.map(({ id }) => id)).toEqual([first.id, second.id]);
	});
});

describe('markApproved', () => {
	it('approves a pending request', async () => {
		const created = await repository.create(fromAda);

		const approved = await repository.markApproved(created.id);

		expect(approved).toEqual({ ...created, status: 'approved' });
		expect(await repository.findById(created.id)).toEqual(approved);
	});

	it('returns null when no pending request has the id', async () => {
		const created = await repository.create(fromAda);
		await repository.markApproved(created.id);

		expect(await repository.markApproved(created.id)).toBeNull();
		expect(await repository.markApproved(missingId)).toBeNull();
	});
});

describe('deletePending', () => {
	it('deletes a pending request', async () => {
		const created = await repository.create(fromAda);

		expect(await repository.deletePending(created.id)).toBe(true);
		expect(await repository.findById(created.id)).toBeNull();
	});

	it('returns false when no pending request has the id', async () => {
		const created = await repository.create(fromAda);
		const approved = await repository.markApproved(created.id);

		expect(await repository.deletePending(created.id)).toBe(false);
		expect(await repository.findById(created.id)).toEqual(approved);
		expect(await repository.deletePending(missingId)).toBe(false);
	});
});
