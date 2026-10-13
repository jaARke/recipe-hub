import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deadlineAfter, settleWithin } from '@/lib/deadline';

class SampleTimeoutError extends Error {}

const timedOut = () => new SampleTimeoutError('Took too long');

// A call that never answers.
function unanswered(): Promise<never> {
	return new Promise(() => {});
}

// A call that never answers until the signal aborts, then rejects in its own way, as an SDK given
// the signal does.
function stoppedBy(signal: AbortSignal): Promise<never> {
	return new Promise((_, reject) => {
		signal.addEventListener('abort', () => reject(new Error('Request aborted')));
	});
}

beforeEach(() => {
	vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});

afterEach(() => {
	vi.useRealTimers();
});

describe('deadlineAfter', () => {
	it('aborts once the time has passed, as AbortSignal.timeout does', async () => {
		const deadline = deadlineAfter(1000);

		await vi.advanceTimersByTimeAsync(999);
		expect(deadline.aborted).toBe(false);
		await vi.advanceTimersByTimeAsync(1);

		expect(deadline.aborted).toBe(true);
		expect(deadline.reason).toBeInstanceOf(DOMException);
		expect(deadline.reason).toMatchObject({ name: 'TimeoutError' });
	});

	it('has passed already when no time is left', () => {
		for (const milliseconds of [0, -5]) {
			const deadline = deadlineAfter(milliseconds);

			expect(deadline.aborted).toBe(true);
			expect(deadline.reason).toMatchObject({ name: 'TimeoutError' });
		}
	});
});

describe('settleWithin', () => {
	it('resolves as the work does before the deadline', async () => {
		await expect(
			settleWithin(Promise.resolve('soup'), { deadline: deadlineAfter(1000) }, timedOut)
		).resolves.toBe('soup');
	});

	it("rejects with the work's own error before the deadline", async () => {
		const error = new Error('Store unreachable');

		await expect(
			settleWithin(Promise.reject(error), { deadline: deadlineAfter(1000) }, timedOut)
		).rejects.toBe(error);
	});

	it('rejects with the timeout error once the deadline passes on work that never answers', async () => {
		const result = settleWithin(unanswered(), { deadline: deadlineAfter(1000) }, timedOut);
		const settled = vi.fn();
		result.catch(settled);

		await vi.advanceTimersByTimeAsync(999);
		expect(settled).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);

		await expect(result).rejects.toThrow(SampleTimeoutError);
	});

	it('rejects with the timeout error when work given the deadline rejects in its own way', async () => {
		const deadline = deadlineAfter(1000);
		const result = settleWithin(stoppedBy(deadline), { deadline }, timedOut);
		result.catch(() => undefined);

		await vi.advanceTimersByTimeAsync(1000);

		await expect(result).rejects.toThrow(SampleTimeoutError);
	});

	it('rejects at once with the timeout error when the deadline has already passed', async () => {
		const deadline = deadlineAfter(0);
		await vi.advanceTimersByTimeAsync(0);

		await expect(settleWithin(unanswered(), { deadline }, timedOut)).rejects.toThrow(
			SampleTimeoutError
		);
	});

	it('rejects with the timeout error when the deadline passed before work that has settled', async () => {
		const deadline = deadlineAfter(0);
		await vi.advanceTimersByTimeAsync(0);

		await expect(settleWithin(Promise.resolve('soup'), { deadline }, timedOut)).rejects.toThrow(
			SampleTimeoutError
		);
	});

	it("rejects with the cancellation's reason when it fired before work that has settled", async () => {
		const cancellation = new AbortController();
		const reason = new Error('Import stopped');
		cancellation.abort(reason);

		await expect(
			settleWithin(
				Promise.resolve('soup'),
				{ deadline: deadlineAfter(1000), cancellation: cancellation.signal },
				timedOut
			)
		).rejects.toBe(reason);
	});

	it('leaves no rejection unhandled from failed work it did not wait on', async () => {
		const deadline = deadlineAfter(0);
		await vi.advanceTimersByTimeAsync(0);
		const unhandled = vi.fn();
		process.on('unhandledRejection', unhandled);

		try {
			await expect(
				settleWithin(Promise.reject(new Error('Store unreachable')), { deadline }, timedOut)
			).rejects.toThrow(SampleTimeoutError);
			await new Promise((resolve) => setImmediate(resolve));
			expect(unhandled).not.toHaveBeenCalled();
		} finally {
			process.off('unhandledRejection', unhandled);
		}
	});

	it("rejects with the cancellation's reason when it fires before the deadline", async () => {
		const cancellation = new AbortController();
		const reason = new Error('Import stopped');
		const result = settleWithin(
			unanswered(),
			{ deadline: deadlineAfter(1000), cancellation: cancellation.signal },
			timedOut
		);
		result.catch(() => undefined);

		cancellation.abort(reason);

		await expect(result).rejects.toBe(reason);
	});

	it("rejects with the cancellation's reason when work given it rejects in its own way", async () => {
		const cancellation = new AbortController();
		const reason = new Error('Import stopped');
		const result = settleWithin(
			stoppedBy(cancellation.signal),
			{ deadline: deadlineAfter(1000), cancellation: cancellation.signal },
			timedOut
		);
		result.catch(() => undefined);

		cancellation.abort(reason);

		await expect(result).rejects.toBe(reason);
	});

	it('tells the deadline from a cancellation that fires after it', async () => {
		const cancellation = new AbortController();
		const result = settleWithin(
			unanswered(),
			{ deadline: deadlineAfter(1000), cancellation: cancellation.signal },
			timedOut
		);
		result.catch(() => undefined);

		await vi.advanceTimersByTimeAsync(1000);
		cancellation.abort(new Error('Import stopped'));

		await expect(result).rejects.toThrow(SampleTimeoutError);
	});

	it('tells a cancellation from a deadline that passes after it in the same tick', async () => {
		const cancellation = new AbortController();
		const reason = new Error('Import stopped');
		const result = settleWithin(
			unanswered(),
			{ deadline: deadlineAfter(1000), cancellation: cancellation.signal },
			timedOut
		);
		result.catch(() => undefined);

		await vi.advanceTimersByTimeAsync(999);
		cancellation.abort(reason);
		vi.advanceTimersByTime(1);

		await expect(result).rejects.toBe(reason);
	});
});
