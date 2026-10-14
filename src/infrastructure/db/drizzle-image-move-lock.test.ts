import { sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DrizzleImageMoveLock } from '@/infrastructure/db/drizzle-image-move-lock';
import { createTestDatabase, type TestDatabase } from '@/infrastructure/db/testing/test-database';

type TestTransaction = Parameters<Parameters<TestDatabase['transaction']>[0]>[0];

let db: TestDatabase;
let lock: DrizzleImageMoveLock;

beforeEach(async () => {
	db = await createTestDatabase();
	lock = new DrizzleImageMoveLock(db);
});

afterEach(async () => {
	await db.$client.close();
});

// The advisory locks this session holds, read through the given connection.
async function heldAdvisoryLocks(connection: TestDatabase | TestTransaction = db): Promise<number> {
	const { rows } = await connection.execute<{ count: number }>(
		sql`select count(*)::int as count from pg_locks where locktype = 'advisory' and pid = pg_backend_pid() and granted`
	);
	return rows[0]?.count ?? 0;
}

// The session's lock_timeout, read through the given connection.
async function lockTimeout(connection: TestDatabase | TestTransaction = db): Promise<string> {
	const { rows } = await connection.execute<{ timeout: string }>(
		sql`select current_setting('lock_timeout') as timeout`
	);
	return rows[0]?.timeout ?? '';
}

// The transaction the lock runs its task in. PGlite runs one transaction at a time, so a query made
// outside it would wait for it to end.
function captureTransaction(): () => TestTransaction {
	const transaction = db.transaction.bind(db);
	let captured: TestTransaction | undefined;
	vi.spyOn(db, 'transaction').mockImplementation((run, config) =>
		transaction((tx) => {
			captured = tx;
			return run(tx);
		}, config)
	);
	return () => {
		if (captured === undefined) {
			throw new Error('The lock ran no transaction');
		}
		return captured;
	};
}

// PGlite runs one transaction at a time, so no second session can hold the lock: these prove the lock
// is held while the task runs and released after, and that run's wait is bounded. That a waiter runs
// once the lock is released, that one past its bound never runs, and that a second sweep skips are
// proven against the in-memory lock.
describe.each([
	['run', (task: () => Promise<string>) => lock.run(task)],
	['tryRun', (task: () => Promise<string>) => lock.tryRun(task)],
])('%s', (_method, runHolding) => {
	it('holds no lock once the task returns', async () => {
		await runHolding(async () => 'swept');

		expect(await heldAdvisoryLocks()).toBe(0);
	});

	it('holds no lock once the task throws, and rethrows its error', async () => {
		await expect(
			runHolding(async () => {
				throw new Error('Blob is unreachable');
			})
		).rejects.toThrow('Blob is unreachable');

		expect(await heldAdvisoryLocks()).toBe(0);
	});
});

describe('run', () => {
	it('runs the task holding an advisory lock and returns its result', async () => {
		const transaction = captureTransaction();

		expect(await lock.run(async () => heldAdvisoryLocks(transaction()))).toBe(1);
	});

	it('bounds its wait with a 10-second lock_timeout set for its transaction alone', async () => {
		const transaction = captureTransaction();

		expect(await lock.run(async () => lockTimeout(transaction()))).toBe('10s');
		expect(await lockTimeout()).toBe('0');
	});
});

describe('tryRun', () => {
	it('runs the task holding an advisory lock and returns its result', async () => {
		const transaction = captureTransaction();

		const attempt = await lock.tryRun(async () => heldAdvisoryLocks(transaction()));

		expect(attempt).toEqual({ status: 'ran', result: 1 });
	});
});
