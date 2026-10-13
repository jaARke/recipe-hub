import 'server-only';
import { sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';

// Waits for the advisory lock named by the key and holds it until the transaction ends, so writers
// that take the same key run one at a time.
export async function lockForTransaction(
	tx: PgDatabase<PgQueryResultHKT>,
	key: string
): Promise<void> {
	await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${key}))`);
}
