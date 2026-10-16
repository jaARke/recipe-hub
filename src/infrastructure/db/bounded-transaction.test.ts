import { sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { boundedTransaction } from '@/infrastructure/db/bounded-transaction';
import { requireBoundedWrites } from '@/infrastructure/db/testing/bounded-writes';
import { createTestDatabase, type TestDatabase } from '@/infrastructure/db/testing/test-database';

let db: TestDatabase;

beforeEach(async () => {
	db = await createTestDatabase();
});

afterEach(async () => {
	await db.$client.close();
});

const timeoutsSchema = z.object({
	rows: z.tuple([z.object({ lockTimeout: z.string(), statementTimeout: z.string() })]),
});

// The session's lock_timeout and statement_timeout, read through the given connection.
async function timeouts(connection: PgDatabase<PgQueryResultHKT> = db) {
	const result = await connection.execute(
		sql`select current_setting('lock_timeout') as "lockTimeout", current_setting('statement_timeout') as "statementTimeout"`
	);
	return timeoutsSchema.parse(result).rows[0];
}

// Fails a statement as Postgres does when it cancels one at a bound, with the error's code.
function cancelledAs(tx: PgDatabase<PgQueryResultHKT>, code: string) {
	return tx.execute(
		sql.raw(`do $$ begin raise exception 'canceling statement' using errcode = '${code}'; end $$`)
	);
}

describe('boundedTransaction', () => {
	it('gives Postgres a 5-second lock wait and a 10-second statement bound for its transaction alone', async () => {
		expect(await boundedTransaction(db, 'adding favorites', (tx) => timeouts(tx))).toEqual({
			lockTimeout: '5s',
			statementTimeout: '10s',
		});
		expect(await timeouts()).toEqual({ lockTimeout: '0', statementTimeout: '0' });
	});

	it.each([
		['55P03', 'A lock wait while adding favorites timed out after 5 seconds'],
		['57014', 'A statement while adding favorites timed out after 10 seconds'],
	])(
		'names the operation and the bound when Postgres cancels a statement with %s',
		async (code, message) => {
			const failure = boundedTransaction(db, 'adding favorites', (tx) => cancelledAs(tx, code));

			await expect(failure).rejects.toThrow(message);
			await expect(failure).rejects.toMatchObject({
				cause: expect.objectContaining({ cause: expect.objectContaining({ code }) }),
			});
		}
	);

	it('passes any other failure on as it is, and keeps none of its writes', async () => {
		const error = new Error('The recipe was edited elsewhere');

		await expect(
			boundedTransaction(db, 'updating a recipe', async (tx) => {
				await tx.execute(sql`create table scratch (id int)`);
				throw error;
			})
		).rejects.toBe(error);
		const { rows } = await db.execute<{ exists: boolean }>(
			sql`select to_regclass('scratch') is not null as exists`
		);
		expect(rows[0]?.exists).toBe(false);
	});
});

describe('requireBoundedWrites', () => {
	it('refuses a row written outside a bounded transaction, and takes one written in it', async () => {
		await db.execute(sql`create table scratch (id int)`);
		await requireBoundedWrites(db, 'scratch');

		await expect(db.execute(sql`insert into scratch values (1)`)).rejects.toThrow(
			expect.objectContaining({
				cause: expect.objectContaining({ message: 'written outside a bounded transaction' }),
			})
		);
		await boundedTransaction(db, 'adding favorites', (tx) =>
			tx.execute(sql`insert into scratch values (2)`)
		);
		const { rows } = await db.execute<{ id: number }>(sql`select id from scratch`);
		expect(rows).toEqual([{ id: 2 }]);
	});
});
