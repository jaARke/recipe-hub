import type { ImageMoveLock, LockAttempt } from '@/application/ports/image-move-lock';

// Past any test's time limit, so a waiter gives up only when a test advances fake timers.
const defaultWaitMs = 60_000;

// Held by one task at a time, as the advisory lock is across a deployment's instances. It takes the
// lock as soon as it is asked, so of two sweeps started together the first runs. The port promises
// waiters no order, and the Drizzle lock's waiters take it at their next try, so a sweep can come
// first; this one hands it to waiters in the order they asked only so tests run the same way every
// time. A waiter gives up once the wait passes, on setTimeout, so fake timers can pass it.
export class InMemoryImageMoveLock implements ImageMoveLock {
	private readonly waitMs: number;
	private readonly waiters: (() => void)[] = [];
	private held = false;

	constructor(waitMs: number = defaultWaitMs) {
		this.waitMs = waitMs;
	}

	get isHeld(): boolean {
		return this.held;
	}

	get waitingCount(): number {
		return this.waiters.length;
	}

	async run<T>(task: () => Promise<T>): Promise<T> {
		await this.acquire();
		try {
			return await task();
		} finally {
			this.release();
		}
	}

	async tryRun<T>(task: () => Promise<T>): Promise<LockAttempt<T>> {
		if (this.held) {
			return { status: 'skipped' };
		}

		this.held = true;
		try {
			return { status: 'ran', result: await task() };
		} finally {
			this.release();
		}
	}

	private acquire(): Promise<void> {
		if (!this.held) {
			this.held = true;
			return Promise.resolve();
		}

		const { promise, resolve, reject } = Promise.withResolvers<void>();
		const grant = () => {
			clearTimeout(timer);
			resolve();
		};
		const timer = setTimeout(() => {
			this.waiters.splice(this.waiters.indexOf(grant), 1);
			reject(new Error('Timed out waiting for the image move lock'));
		}, this.waitMs);
		this.waiters.push(grant);
		return promise;
	}

	// Hands the lock straight to the next waiter, so no task can take it in between.
	private release(): void {
		const next = this.waiters.shift();
		if (next === undefined) {
			this.held = false;
		} else {
			next();
		}
	}
}
