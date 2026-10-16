import 'server-only';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type { ImageMoveLock, LockAttempt } from '@/application/ports/image-move-lock';
import { tryLockForTransaction } from '@/infrastructure/db/transaction-lock';
import { deadlineAfter, settleWithin } from '@/lib/deadline';

// Every image move takes this transaction-scoped lock, so one move at a time runs against each
// environment's database.
const imageMoveLockKey = 'recipe-hub:image-moves';

// A sweep holds the lock through seconds of Blob calls, and a write's removal waits for it in a
// background task after the response: long enough for a sweep to finish, short enough that a stuck
// one never keeps that task's function alive for long.
const lockWaitTimeoutMs = 10_000;

// How long a waiting removal pauses before it asks for the lock again.
const lockRetryIntervalMs = 500;

function lockWaitTimedOut(): Error {
	return new Error(
		`The wait for the image move lock timed out after ${lockWaitTimeoutMs / 1000} seconds`
	);
}

function pause(milliseconds: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

// A transaction-scoped lock, since the pooler can hand a session lock and its unlock to different
// server connections. The transaction holds one connection for the whole task and ends on every
// path, which releases the lock; the task's own queries run on other connections. A waiter asks
// again after each pause rather than waiting in Postgres, so it holds no connection while it waits,
// and waiters never take the connections the holder's task needs.
export class DrizzleImageMoveLock implements ImageMoveLock {
	private readonly db: PgDatabase<PgQueryResultHKT>;

	constructor(db: PgDatabase<PgQueryResultHKT>) {
		this.db = db;
	}

	async run<T>(task: () => Promise<T>): Promise<T> {
		const deadline = deadlineAfter(lockWaitTimeoutMs);
		for (;;) {
			const attempt = await this.attempt(task, deadline);
			if (attempt.status === 'ran') {
				return attempt.result;
			}

			await settleWithin(pause(lockRetryIntervalMs), { deadline }, lockWaitTimedOut);
		}
	}

	async tryRun<T>(task: () => Promise<T>): Promise<LockAttempt<T>> {
		return this.attempt(task);
	}

	// Runs the task holding the lock, or skips it while another image move holds the lock. A lock taken
	// after the deadline passed is released without running the task.
	private async attempt<T>(
		task: () => Promise<T>,
		deadline?: AbortSignal
	): Promise<LockAttempt<T>> {
		return this.db.transaction(async (tx): Promise<LockAttempt<T>> => {
			if (!(await tryLockForTransaction(tx, imageMoveLockKey))) {
				return { status: 'skipped' };
			}
			if (deadline?.aborted) {
				throw lockWaitTimedOut();
			}

			return { status: 'ran', result: await task() };
		});
	}
}
