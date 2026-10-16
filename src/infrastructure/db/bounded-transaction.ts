import 'server-only';
import { sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { queryErrorCause } from '@/lib/errors';

// A write holds its locks for a few short statements, so a wait this long means a stuck holder.
const lockTimeoutMs = 5_000;

// A write's statements answer in milliseconds, so one still running this long is stuck.
export const statementTimeoutMs = 10_000;

type Bound = {
	// What Postgres cancelled once the bound passed.
	cancelled: string;
	timeoutMs: number;
};

// Each bound by the code of the error Postgres fails a statement with when the bound passes.
const boundsByErrorCode = new Map<string, Bound>([
	['55P03', { cancelled: 'A lock wait', timeoutMs: lockTimeoutMs }],
	['57014', { cancelled: 'A statement', timeoutMs: statementTimeoutMs }],
]);

// An error naming the operation and the bound Postgres cancelled its statement at, with Postgres's
// error as its cause; any other error as it is.
function namingBound(error: unknown, operation: string): unknown {
	const code = error instanceof Error ? queryErrorCause(error)?.code : undefined;
	const bound = code === undefined ? undefined : boundsByErrorCode.get(code);
	if (bound === undefined) {
		return error;
	}

	return new Error(
		`${bound.cancelled} while ${operation} timed out after ${bound.timeoutMs / 1000} seconds`,
		{ cause: error }
	);
}

// Runs a write in a transaction where Postgres cancels any lock wait or statement past its bound,
// failing the transaction, and names the operation and the bound when it does. Set for the
// transaction alone: Neon's pooler ignores both settings as startup parameters and refuses them in
// the options parameter.
export async function boundedTransaction<T>(
	db: PgDatabase<PgQueryResultHKT>,
	operation: string,
	work: (tx: PgDatabase<PgQueryResultHKT>) => Promise<T>
): Promise<T> {
	try {
		return await db.transaction(async (tx) => {
			// SET LOCAL in the form that takes a parameter; Postgres reads a value without units as milliseconds.
			await tx.execute(
				sql`select set_config('lock_timeout', ${String(lockTimeoutMs)}, true), set_config('statement_timeout', ${String(statementTimeoutMs)}, true)`
			);
			return work(tx);
		});
	} catch (error) {
		throw namingBound(error, operation);
	}
}
