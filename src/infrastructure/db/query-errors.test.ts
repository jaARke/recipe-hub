import { inspect } from 'node:util';
import { DrizzleQueryError } from 'drizzle-orm/errors';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { printQueryErrorsWithoutParameters } from '@/infrastructure/db/query-errors';
import { users } from '@/infrastructure/db/schema';
import { createTestDatabase, type TestDatabase } from '@/infrastructure/db/testing/test-database';
import { isQueryError, withoutQueryParameters } from '@/lib/errors';
import { getLogger } from '@/lib/logger';

const email = 'ada@example.com';

let db: TestDatabase;

beforeAll(() => {
	printQueryErrorsWithoutParameters();
});

beforeEach(async () => {
	db = await createTestDatabase();
	await db.insert(users).values({ displayName: 'Ada', email });
});

afterEach(() => {
	vi.restoreAllMocks();
});

// A second account with a taken email, which Postgres refuses.
async function duplicateAccount(): Promise<DrizzleQueryError> {
	const error = await db
		.insert(users)
		.values({ displayName: 'Ada', email })
		.catch((caught: unknown) => caught);

	expect(error).toBeInstanceOf(DrizzleQueryError);
	return error as DrizzleQueryError;
}

describe('failed queries', () => {
	it('carry their parameters where the logger and the print patch expect them', async () => {
		const error = await duplicateAccount();

		expect(error.message).toMatch(
			/^Failed query: insert into "users" .+\nparams: Ada,ada@example\.com$/
		);
		expect(error.params).toEqual(['Ada', email]);
		expect(error.cause).toMatchObject({ code: '23505', detail: expect.stringContaining(email) });
		expect(isQueryError(error)).toBe(true);
		expect(withoutQueryParameters(error.message)).not.toContain(email);
	});

	it('are logged without their parameters', async () => {
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

		getLogger('test').error('Sign-up failed', { err: await duplicateAccount() });

		expect(String(consoleError.mock.calls[0]?.[0])).not.toContain(email);
	});

	it('print their SQL and what failed, without their parameters', async () => {
		const error = await duplicateAccount();

		const printed = inspect(new Error('Render failed', { cause: error }));

		expect(printed).toContain('Failed query: insert into "users"');
		expect(printed).toContain("code: '23505'");
		expect(printed).toContain("constraint: 'users_email_unique'");
		expect(printed).toContain("table: 'users'");
		expect(printed).not.toContain(email);
		expect(String(error)).toBe(`Error: ${withoutQueryParameters(error.message)}`);
	});

	it('log and print no value their cause quotes', async () => {
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
		const canary = 'secret-value-canary';
		const error = await db
			.insert(users)
			.values({ displayName: 'Grace', email: 'grace@example.com', inviteId: canary })
			.catch((caught: unknown) => caught);
		expect(error).toBeInstanceOf(DrizzleQueryError);
		expect((error as DrizzleQueryError).cause).toMatchObject({
			message: expect.stringContaining(canary),
		});
		const wrapped = new Error('Sign-up failed', { cause: error });

		getLogger('test').error('Sign-up failed', { err: wrapped });

		const line = String(consoleError.mock.calls[0]?.[0]);
		expect(line).not.toContain(canary);
		expect(JSON.parse(line).err.cause.cause).toEqual({ name: 'error', code: '22P02' });
		expect(inspect(wrapped)).not.toContain(canary);
		expect(String(error)).not.toContain(canary);
	});
});
