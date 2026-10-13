import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryImageMoveLock } from '@/application/testing/in-memory-image-move-lock';

const waitMs = 1000;

let lock: InMemoryImageMoveLock;

beforeEach(() => {
	vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
	lock = new InMemoryImageMoveLock(waitMs);
});

afterEach(() => {
	vi.useRealTimers();
});

// A task that holds the lock until the returned function ends it.
function holding(): { task: () => Promise<void>; end: () => void } {
	const done = Promise.withResolvers<void>();
	return { task: () => done.promise, end: () => done.resolve() };
}

describe('run', () => {
	it('runs the task at once when the lock is free, returns its result, and releases the lock', async () => {
		expect(await lock.run(async () => 'removed')).toBe('removed');
		expect(lock.isHeld).toBe(false);
	});

	it('queues waiters and runs each in the order they asked, once the one before releases', async () => {
		const first = holding();
		const second = holding();
		const ran: string[] = [];
		const running = [
			lock.run(async () => {
				ran.push('first');
				await first.task();
			}),
			lock.run(async () => {
				ran.push('second');
				await second.task();
			}),
			lock.run(async () => {
				ran.push('third');
			}),
		];

		await vi.advanceTimersByTimeAsync(0);
		expect(ran).toEqual(['first']);
		expect(lock.waitingCount).toBe(2);
		first.end();
		await vi.advanceTimersByTimeAsync(0);
		expect(ran).toEqual(['first', 'second']);
		expect(lock.waitingCount).toBe(1);
		second.end();
		await Promise.all(running);

		expect(ran).toEqual(['first', 'second', 'third']);
		expect(lock.isHeld).toBe(false);
	});

	it('hands the lock on when a task throws, and rethrows its error', async () => {
		const failing = lock.run(async () => {
			throw new Error('Blob is unreachable');
		});
		const next = lock.run(async () => 'removed');

		await expect(failing).rejects.toThrow('Blob is unreachable');
		expect(await next).toBe('removed');
		expect(lock.isHeld).toBe(false);
	});

	it('throws without running the task once the lock stays held past the wait, and leaves the queue', async () => {
		const sweep = holding();
		const sweeping = lock.tryRun(sweep.task);
		const task = vi.fn(async () => 'removed');

		const waiting = lock.run(task);
		const settled = vi.fn();
		waiting.catch(settled);
		await vi.advanceTimersByTimeAsync(waitMs - 1);
		expect(settled).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);

		await expect(waiting).rejects.toThrow('Timed out waiting for the image move lock');
		expect(lock.waitingCount).toBe(0);
		sweep.end();
		await sweeping;
		expect(task).not.toHaveBeenCalled();
		expect(lock.isHeld).toBe(false);
	});

	it('never times out a waiter granted the lock in time, nor the one queued after it', async () => {
		const sweep = holding();
		const sweeping = lock.tryRun(sweep.task);
		const first = holding();

		const firstWaiting = lock.run(first.task);
		await vi.advanceTimersByTimeAsync(waitMs - 1);
		sweep.end();
		await sweeping;
		const secondWaiting = lock.run(async () => 'removed');
		// The first waiter's wait would pass here, while it holds the lock.
		await vi.advanceTimersByTimeAsync(1);
		first.end();
		await firstWaiting;
		await vi.advanceTimersByTimeAsync(waitMs);

		expect(await secondWaiting).toBe('removed');
		expect(lock.isHeld).toBe(false);
	});
});

describe('tryRun', () => {
	it('skips the task while a task given to run holds the lock, and runs it once released', async () => {
		const removal = holding();
		const removing = lock.run(removal.task);
		const task = vi.fn(async () => 'swept');

		expect(await lock.tryRun(task)).toEqual({ status: 'skipped' });
		removal.end();
		await removing;

		expect(await lock.tryRun(task)).toEqual({ status: 'ran', result: 'swept' });
		expect(task).toHaveBeenCalledOnce();
	});

	it('holds the lock against run, which waits for its task to end', async () => {
		const sweep = holding();
		const sweeping = lock.tryRun(sweep.task);
		const task = vi.fn(async () => 'removed');

		const waiting = lock.run(task);
		await vi.advanceTimersByTimeAsync(0);
		expect(task).not.toHaveBeenCalled();
		sweep.end();

		expect(await sweeping).toEqual({ status: 'ran', result: undefined });
		expect(await waiting).toBe('removed');
	});
});
