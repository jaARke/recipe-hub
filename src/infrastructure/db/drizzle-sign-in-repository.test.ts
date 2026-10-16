import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DrizzleMemberRepository } from '@/infrastructure/db/drizzle-member-repository';
import { DrizzleSignInRepository } from '@/infrastructure/db/drizzle-sign-in-repository';
import { sessions, verifications } from '@/infrastructure/db/schema';
import { createTestDatabase, type TestDatabase } from '@/infrastructure/db/testing/test-database';

const cutoff = new Date('2026-10-14T12:00:00Z');
const beforeCutoff = new Date('2026-10-14T11:59:00Z');
const afterCutoff = new Date('2026-10-14T12:01:00Z');

let db: TestDatabase;
let repository: DrizzleSignInRepository;

beforeEach(async () => {
	db = await createTestDatabase();
	repository = new DrizzleSignInRepository(db);
});

afterEach(async () => {
	await db.$client.close();
});

describe('deleteSessionsExpiredBefore', () => {
	it('deletes every session that expired before the cutoff, of every member, and keeps the rest', async () => {
		const members = new DrizzleMemberRepository(db);
		const ada = await members.create({
			email: 'ada@example.com',
			displayName: 'Ada',
			role: 'member',
		});
		const grace = await members.create({
			email: 'grace@example.com',
			displayName: 'Grace',
			role: 'member',
		});
		await db.insert(sessions).values([
			{ userId: ada.id, token: 'ada-expired', expiresAt: beforeCutoff },
			{ userId: grace.id, token: 'grace-expired', expiresAt: beforeCutoff },
			{ userId: grace.id, token: 'grace-expiring-at-cutoff', expiresAt: cutoff },
			{ userId: ada.id, token: 'ada-live', expiresAt: afterCutoff },
		]);

		expect(await repository.deleteSessionsExpiredBefore(cutoff)).toBe(2);

		const remaining = await db.select({ token: sessions.token }).from(sessions);
		expect(remaining.map(({ token }) => token).toSorted()).toEqual([
			'ada-live',
			'grace-expiring-at-cutoff',
		]);
	});
});

describe('deleteVerificationsExpiredBefore', () => {
	it('deletes every verification that expired before the cutoff, and keeps the rest', async () => {
		await db.insert(verifications).values([
			{ identifier: 'sign-in-otp-ada@example.com', value: 'code', expiresAt: beforeCutoff },
			{ identifier: 'expired-challenge', value: '{}', expiresAt: beforeCutoff },
			{ identifier: 'live-challenge', value: '{}', expiresAt: afterCutoff },
		]);

		expect(await repository.deleteVerificationsExpiredBefore(cutoff)).toBe(2);

		expect(await db.select({ identifier: verifications.identifier }).from(verifications)).toEqual([
			{ identifier: 'live-challenge' },
		]);
	});
});
