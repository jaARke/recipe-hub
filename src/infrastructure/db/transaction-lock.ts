import 'server-only';
import { sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { z } from 'zod';

// The one row pg_try_advisory_xact_lock answers, which each driver returns under rows.
const tryLockResultSchema = z.object({ rows: z.tuple([z.object({ locked: z.boolean() })]) });

// Waits for the advisory lock named by the key and holds it until the transaction ends, so writers
// that take the same key run one at a time.
export async function lockForTransaction(
	tx: PgDatabase<PgQueryResultHKT>,
	key: string
): Promise<void> {
	await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${key}))`);
}

// As lockForTransaction, but Postgres cancels the wait once the timeout passes, failing the statement
// and so the transaction, which then never takes the lock. The timeout bounds every later lock wait
// in the transaction too.
export async function lockForTransactionWithin(
	tx: PgDatabase<PgQueryResultHKT>,
	key: string,
	timeoutMs: number
): Promise<void> {
	// SET LOCAL in the form that takes a parameter; Postgres reads a value without units as milliseconds.
	await tx.execute(sql`select set_config('lock_timeout', ${String(timeoutMs)}, true)`);
	await lockForTransaction(tx, key);
}

// Takes the advisory lock named by the key and holds it until the transaction ends, or returns false
// at once when another session holds it.
export async function tryLockForTransaction(
	tx: PgDatabase<PgQueryResultHKT>,
	key: string
): Promise<boolean> {
	const result = await tx.execute(
		sql`select pg_try_advisory_xact_lock(hashtext(${key})) as locked`
	);
	const [{ locked }] = tryLockResultSchema.parse(result).rows;
	return locked;
}
