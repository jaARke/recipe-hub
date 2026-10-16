// What ends a wait early: a deadline that passes, and a cancellation the caller may signal.
export type WaitLimits = {
	deadline: AbortSignal;
	cancellation?: AbortSignal;
};

// What ends a request early: its own time limit, and a cancellation the caller may signal.
export type RequestLimits = {
	timeLimitMs: number;
	cancellation?: AbortSignal;
};

// A signal that aborts once the time has passed, with the reason AbortSignal.timeout gives. Node runs
// AbortSignal.timeout on internal timers that fake timers cannot reach, so this one runs on setTimeout,
// unref'd as Node's is, so a deadline never keeps a process alive. A browser's timer is a number with
// nothing to unref.
export function deadlineAfter(milliseconds: number): AbortSignal {
	const reason = () => new DOMException('The operation timed out.', 'TimeoutError');
	// No time left means the deadline has passed already, rather than at the timer's next turn.
	if (milliseconds <= 0) {
		return AbortSignal.abort(reason());
	}

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(reason()), milliseconds);
	if (typeof timer === 'object') {
		timer.unref();
	}
	return controller.signal;
}

// Settles as the work does, unless the deadline passes or the cancellation fires first: then it
// rejects with timedOut's error or the cancellation's reason, and a limit reached before the call
// rejects at once, however the work settles. Work given the signals rejects in its own way once one
// fires, so the signal that fired first decides, never the error the work rejects with.
export async function settleWithin<T>(
	work: Promise<T>,
	{ deadline, cancellation }: WaitLimits,
	timedOut: () => Error
): Promise<T> {
	const signals = cancellation === undefined ? [deadline] : [deadline, cancellation];
	const outcome = (signal: AbortSignal): unknown =>
		signal === deadline ? timedOut() : signal.reason;
	const reachedBefore = signals.find(({ aborted }) => aborted);
	if (reachedBefore !== undefined) {
		// The work is left behind, so its failure must not go unhandled.
		work.catch(() => undefined);
		throw outcome(reachedBefore);
	}

	let firedFirst: AbortSignal | undefined;
	const stopped = Promise.withResolvers<never>();
	const listening = new AbortController();
	for (const signal of signals) {
		signal.addEventListener(
			'abort',
			() => {
				firedFirst ??= signal;
				stopped.reject(new Error('A wait limit was reached'));
			},
			{ signal: listening.signal }
		);
	}
	try {
		return await Promise.race([work, stopped.promise]);
	} catch (error) {
		throw firedFirst === undefined ? error : outcome(firedFirst);
	} finally {
		listening.abort();
	}
}

// Settles as settleWithin does, giving the request a signal that aborts once the wait gives up, so a
// request left behind stops rather than running on; once the cancellation has fired, none starts. A
// request that answered in time keeps the cancellation alone, so a body it streams stops only with it.
export async function requestWithin<T>(
	request: (signal: AbortSignal) => Promise<T>,
	{ timeLimitMs, cancellation }: RequestLimits,
	timedOut: () => Error
): Promise<T> {
	cancellation?.throwIfAborted();
	const abandoned = new AbortController();
	const signal =
		cancellation === undefined
			? abandoned.signal
			: AbortSignal.any([abandoned.signal, cancellation]);
	try {
		return await settleWithin(
			request(signal),
			{ deadline: deadlineAfter(timeLimitMs), cancellation },
			timedOut
		);
	} catch (error) {
		abandoned.abort(error);
		throw error;
	}
}
