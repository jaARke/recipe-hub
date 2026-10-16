import { sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
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

// A database where another session holds the image move lock until it is released, counting the
// transactions this lock has open, each holding a connection. Each try answers after the given time,
// or at once.
function databaseHeldElsewhere(answerAfterMs = 0) {
	let heldElsewhere = true;
	let tries = 0;
	let open = 0;
	let mostOpen = 0;
	const tx = {
		execute: async () => {
			tries += 1;
			if (answerAfterMs > 0) {
				await new Promise((resolve) => setTimeout(resolve, answerAfterMs));
			}
			return { rows: [{ locked: !heldElsewhere }] };
		},
	};
	const database = {
		transaction: async <T>(run: (transaction: typeof tx) => Promise<T>): Promise<T> => {
			open += 1;
			mostOpen = Math.max(mostOpen, open);
			try {
				return await run(tx);
			} finally {
				open -= 1;
			}
		},
	};
	return {
		lock: new DrizzleImageMoveLock(database as unknown as PgDatabase<PgQueryResultHKT>),
		release: () => {
			heldElsewhere = false;
		},
		tries: () => tries,
		open: () => open,
		mostOpen: () => mostOpen,
	};
}

// PGlite runs one transaction at a time, so no second session can hold the lock: these prove the lock
// is held while the task runs and released after. How run waits is proven against a database where
// another session holds it; that a second sweep skips is proven against the in-memory lock.
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
});

describe('run, while another image move holds the lock', () => {
	beforeEach(() => {
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('asks again every half second, holding no connection in between, and runs the task once it is free', async () => {
		const elsewhere = databaseHeldElsewhere();
		const task = vi.fn(async () => 'removed');

		const running = elsewhere.lock.run(task);
		await vi.advanceTimersByTimeAsync(499);
		expect(elsewhere.tries()).toBe(1);
		expect(elsewhere.open()).toBe(0);
		await vi.advanceTimersByTimeAsync(1);
		expect(elsewhere.tries()).toBe(2);
		elsewhere.release();
		await vi.advanceTimersByTimeAsync(500);

		expect(await running).toBe('removed');
		expect(task).toHaveBeenCalledOnce();
		expect(elsewhere.tries()).toBe(3);
		expect(elsewhere.mostOpen()).toBe(1);
	});

	it('gives up at 10 seconds with an error naming the lock and the bound, never running the task', async () => {
		const elsewhere = databaseHeldElsewhere();
		const task = vi.fn(async () => 'removed');

		const waiting = elsewhere.lock.run(task);
		const settled = vi.fn();
		waiting.catch(settled);
		await vi.advanceTimersByTimeAsync(10_000 - 1);
		expect(settled).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);

		await expect(waiting).rejects.toThrow(
			'The wait for the image move lock timed out after 10 seconds'
		);
		expect(task).not.toHaveBeenCalled();
		expect(elsewhere.tries()).toBe(20);
		expect(elsewhere.open()).toBe(0);
		expect(elsewhere.mostOpen()).toBe(1);
	});

	it('releases a lock it takes only after the bound passed, never running the task', async () => {
		const elsewhere = databaseHeldElsewhere(10_500);
		elsewhere.release();
		const task = vi.fn(async () => 'removed');

		const waiting = elsewhere.lock.run(task);
		waiting.catch(() => undefined);
		await vi.advanceTimersByTimeAsync(10_500);

		await expect(waiting).rejects.toThrow(
			'The wait for the image move lock timed out after 10 seconds'
		);
		expect(task).not.toHaveBeenCalled();
		expect(elsewhere.open()).toBe(0);
	});
});

describe('tryRun', () => {
	it('runs the task holding an advisory lock and returns its result', async () => {
		const transaction = captureTransaction();

		const attempt = await lock.tryRun(async () => heldAdvisoryLocks(transaction()));

		expect(attempt).toEqual({ status: 'ran', result: 1 });
	});
});
