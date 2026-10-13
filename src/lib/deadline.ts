// What ends a wait early: a deadline that passes, and a cancellation the caller may signal.
export type WaitLimits = {
	deadline: AbortSignal;
	cancellation?: AbortSignal;
};

// A signal that aborts once the time has passed, with the reason AbortSignal.timeout gives. Node runs
// AbortSignal.timeout on internal timers that fake timers cannot reach, so this one runs on setTimeout,
// unref'd as Node's is, so a deadline never keeps a process alive.
export function deadlineAfter(milliseconds: number): AbortSignal {
	const controller = new AbortController();
	setTimeout(
		() => controller.abort(new DOMException('The operation timed out.', 'TimeoutError')),
		milliseconds
	).unref();
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
