import 'server-only';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type { ImageMoveLock, LockAttempt } from '@/application/ports/image-move-lock';
import {
	lockForTransactionWithin,
	tryLockForTransaction,
} from '@/infrastructure/db/transaction-lock';

// Every image move takes this transaction-scoped lock, so one move at a time runs against each
// environment's database.
const imageMoveLockKey = 'recipe-hub:image-moves';

// A sweep holds the lock through seconds of Blob calls, and a write's removal waits for it in a
// background task after the response: long enough for a sweep to finish, short enough that a stuck
// one never keeps that task's function alive for long.
const lockWaitTimeoutMs = 10_000;

// A transaction-scoped lock, since the pooler can hand a session lock and its unlock to different
// server connections. The transaction holds one connection for the whole task and ends on every
// path, which releases the lock; the task's own queries run on other connections.
export class DrizzleImageMoveLock implements ImageMoveLock {
	private readonly db: PgDatabase<PgQueryResultHKT>;

	constructor(db: PgDatabase<PgQueryResultHKT>) {
		this.db = db;
	}

	// Postgres bounds the wait itself, so a wait that times out never takes the lock afterwards.
	async run<T>(task: () => Promise<T>): Promise<T> {
		return this.db.transaction(async (tx): Promise<T> => {
			await lockForTransactionWithin(tx, imageMoveLockKey, lockWaitTimeoutMs);
			return task();
		});
	}

	async tryRun<T>(task: () => Promise<T>): Promise<LockAttempt<T>> {
		return this.db.transaction(async (tx): Promise<LockAttempt<T>> => {
			if (!(await tryLockForTransaction(tx, imageMoveLockKey))) {
				return { status: 'skipped' };
			}

			return { status: 'ran', result: await task() };
		});
	}
}
