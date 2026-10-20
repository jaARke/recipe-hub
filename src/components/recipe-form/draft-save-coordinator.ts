import { deadlineAfter, settleWithin } from '@/lib/deadline';

// Keeps the member's draft on the server in step with the recipe form as they fill it in, so a draft
// exists while the form holds something and goes once it holds nothing. Pure apart from its timers, so
// its ordering is tested without a browser.
//
// What it promises: one request at a time, a debounce after the last change, and only the latest
// content waiting behind a request in flight, so a change during a draft's first save never makes a
// second draft and an earlier save never lands after a later one. Every wait on a request is bounded;
// a request past its bound may still land, and nothing is sent until it does, since Next sends one
// Server Action at a time and a later request would wait behind it anyway.

// After the last change, so a save goes as typing pauses rather than with every key.
const saveDebounceMs = 1_000;

// Longer than a save takes at its slowest, with a cold database and a photo looked up in storage at
// its own 15-second bound, so only a lost connection reaches it.
const draftRequestTimeLimitMs = 30_000;

// A draft on the server, with when it was last saved, which is the version of it the form has.
export type DraftVersion = {
	id: string;
	savedAt: Date;
};

// A request the server answered with a refusal.
export type DraftRefusal = {
	status: 'refused';
	message: string | undefined;
	// A refusal about the whole draft, such as a save another page made since or an ended session,
	// stops saving until the page opens again; one at a place in the form can be fixed there.
	stopsSaving: boolean;
};

export type DraftSaveOutcome = { status: 'saved'; draft: DraftVersion } | DraftRefusal;

export type DraftDeleteOutcome = { status: 'deleted' } | DraftRefusal;

// What the coordinator asks of the server: each rejects when it never reaches the site, as offline.
export type DraftRequests<Content> = {
	// Over the draft held, or as a new draft without one.
	save: (content: Content, held: DraftVersion | undefined) => Promise<DraftSaveOutcome>;
	// At the version held, so a draft another page saved since is kept.
	delete: (held: DraftVersion) => Promise<DraftDeleteOutcome>;
};

// What the form says of its draft, where it has anything to say.
export type DraftSaveStatus =
	| { kind: 'saving' }
	| { kind: 'saved' }
	// The last request failed to reach the site or outlasted its bound.
	| { kind: 'unreachable' }
	| { kind: 'refused'; message: string | undefined };

export type DraftSaveState<Content> = {
	held: DraftVersion | undefined;
	// What the server holds of the draft held, or the empty content without one.
	saved: Content;
	// Whether the form shows anything the server may not hold yet: a change not saved, or a request
	// still on its way.
	unsaved: boolean;
	// Nothing while no draft is held and nothing is saving or failed, as for an empty form.
	status: DraftSaveStatus | undefined;
};

// Where saving stands once it has done what it can.
export type DraftSettlement = {
	held: DraftVersion | undefined;
	// Whether the server holds what the form shows.
	current: boolean;
	// Whether a refusal stopped saving for good.
	halted: boolean;
};

export type DraftSaveCoordinator<Content> = {
	subscribe: (listener: () => void) => () => void;
	getSnapshot: () => DraftSaveState<Content>;
	// What the form now shows, saved a debounce after the last change.
	change: (content: Content) => void;
	// Sends what is waiting at once, as when the page hides, and tries again after a failure.
	flush: () => void;
	// Flushes, then waits until the server holds what the form shows or saving can do no more.
	settle: () => Promise<DraftSettlement>;
	// Holds saving while the recipe is added or the draft deleted: drops what is waiting, waits for a
	// request in flight, and returns the draft then held.
	stop: () => Promise<DraftVersion | undefined>;
	// Lets saving go on after stop, as when adding or deleting failed.
	resume: () => void;
	// The draft it held was deleted outside saving, as its page's menu does: it holds none, takes what
	// the form shows as nothing to send, and saves it as a new draft once it changes again.
	forget: () => void;
};

export type DraftSaveCoordinatorOptions<Content> = {
	requests: DraftRequests<Content>;
	// The draft the form opened, if any.
	opened: DraftVersion | undefined;
	// What the form opened with: what the opened draft holds, or else an empty form.
	initial: Content;
	// What an empty form holds, for which no draft is kept.
	empty: Content;
	// Whether two contents show the member the same thing.
	same: (a: Content, b: Content) => boolean;
};

type Outcome = DraftSaveOutcome | DraftDeleteOutcome;

// A request sent, with what it sent.
type DraftRequest<Content> = {
	content: Content;
	timedOut: boolean;
};

type Waiter = { done: () => boolean; resolve: () => void };

class DraftRequestTimedOutError extends Error {}

export function createDraftSaveCoordinator<Content>({
	requests,
	opened,
	initial,
	empty,
	same,
}: DraftSaveCoordinatorOptions<Content>): DraftSaveCoordinator<Content> {
	const listeners = new Set<() => void>();
	const waiters = new Set<Waiter>();
	let held = opened;
	let saved = opened === undefined ? empty : initial;
	let latest = initial;
	let inFlight: DraftRequest<Content> | undefined;
	let debounce: ReturnType<typeof setTimeout> | undefined;
	// The debounce ended while a request was in flight, so the latest content goes once it settles.
	let due = false;
	let failure: DraftSaveStatus | undefined;
	let halted = false;
	let stopped = false;
	let state: DraftSaveState<Content> = {
		held,
		saved,
		unsaved: hasUnsaved(),
		status: currentStatus(),
	};

	function hasUnsaved(): boolean {
		return inFlight !== undefined || !same(latest, saved);
	}

	function currentStatus(): DraftSaveStatus | undefined {
		if (halted && failure !== undefined) {
			return failure;
		}
		if (inFlight?.timedOut === true) {
			return { kind: 'unreachable' };
		}
		if (inFlight !== undefined || debounce !== undefined || due) {
			return { kind: 'saving' };
		}
		if (failure !== undefined) {
			return failure;
		}
		return held === undefined ? undefined : { kind: 'saved' };
	}

	function sameStatus(a: DraftSaveStatus | undefined, b: DraftSaveStatus | undefined): boolean {
		const message = (status: DraftSaveStatus | undefined) =>
			status !== undefined && 'message' in status ? status.message : undefined;
		return a?.kind === b?.kind && message(a) === message(b);
	}

	// Saving does nothing more until the request in flight settles, or ever once halted.
	function idle(): boolean {
		if (halted || inFlight?.timedOut === true) {
			return true;
		}
		return inFlight === undefined && debounce === undefined && !due;
	}

	// Shares the state once something in it changed, then lets go of the waits it ends.
	function publish() {
		const status = currentStatus();
		const unsaved = hasUnsaved();
		if (
			state.held !== held ||
			state.saved !== saved ||
			state.unsaved !== unsaved ||
			!sameStatus(state.status, status)
		) {
			state = { held, saved, unsaved, status };
			for (const listener of listeners) {
				listener();
			}
		}
		for (const waiter of waiters) {
			if (waiter.done()) {
				waiters.delete(waiter);
				waiter.resolve();
			}
		}
	}

	function waitUntilIdle(): Promise<void> {
		if (idle()) {
			return Promise.resolve();
		}
		return new Promise((resolve) => waiters.add({ done: idle, resolve }));
	}

	function clearDebounce() {
		clearTimeout(debounce);
		debounce = undefined;
	}

	// Brings the server to what the form shows: a save, a delete once emptied, or nothing.
	function sendLatest() {
		due = false;
		const content = latest;
		if (same(content, saved)) {
			publish();
			return;
		}
		const draft = held;
		if (!same(content, empty)) {
			send(content, () => requests.save(content, draft));
		} else if (draft !== undefined) {
			send(content, () => requests.delete(draft));
		} else {
			// An empty form keeps no draft, and none is held.
			saved = content;
			publish();
		}
	}

	function send(content: Content, request: () => Promise<Outcome>) {
		const sent: DraftRequest<Content> = { content, timedOut: false };
		inFlight = sent;
		let work: Promise<Outcome>;
		try {
			work = request();
		} catch (error) {
			work = Promise.reject(error);
		}
		publish();
		void settleWithin(
			work,
			{ deadline: deadlineAfter(draftRequestTimeLimitMs) },
			() => new DraftRequestTimedOutError('The draft request timed out')
		).then(
			(outcome) => land(sent, outcome),
			(error: unknown) => {
				if (!(error instanceof DraftRequestTimedOutError)) {
					land(sent, undefined);
					return;
				}
				sent.timedOut = true;
				publish();
				// It may still land, and saving goes on from what it did.
				void work.then(
					(outcome) => land(sent, outcome),
					() => land(sent, undefined)
				);
			}
		);
	}

	// What a request did, or undefined for one that never reached the site.
	function land(sent: DraftRequest<Content>, outcome: Outcome | undefined) {
		if (inFlight !== sent) {
			return;
		}
		inFlight = undefined;
		switch (outcome?.status) {
			case undefined:
				failure = { kind: 'unreachable' };
				break;
			case 'saved':
				held = outcome.draft;
				saved = sent.content;
				failure = undefined;
				break;
			case 'deleted':
				held = undefined;
				saved = empty;
				failure = undefined;
				break;
			case 'refused':
				failure = { kind: 'refused', message: outcome.message };
				halted = outcome.stopsSaving;
				break;
		}
		if (due && !halted && !stopped) {
			sendLatest();
		} else {
			due = false;
			publish();
		}
	}

	function flush() {
		if (halted || stopped) {
			return;
		}
		clearDebounce();
		if (inFlight === undefined) {
			sendLatest();
		} else {
			due = true;
			publish();
		}
	}

	return {
		subscribe(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		getSnapshot: () => state,
		change(content) {
			const changed = !same(content, latest);
			latest = content;
			if (!changed) {
				return;
			}
			if (halted || stopped) {
				publish();
				return;
			}
			clearDebounce();
			debounce = setTimeout(() => {
				debounce = undefined;
				if (inFlight === undefined) {
					sendLatest();
				} else {
					due = true;
					publish();
				}
			}, saveDebounceMs);
			publish();
		},
		flush,
		async settle() {
			flush();
			await waitUntilIdle();
			return {
				held,
				current: inFlight === undefined && same(latest, saved),
				halted,
			};
		},
		async stop() {
			stopped = true;
			clearDebounce();
			due = false;
			publish();
			await waitUntilIdle();
			return held;
		},
		resume() {
			stopped = false;
			if (!halted && !same(latest, saved)) {
				flush();
			} else {
				publish();
			}
		},
		forget() {
			clearDebounce();
			due = false;
			held = undefined;
			saved = latest;
			failure = undefined;
			halted = false;
			stopped = false;
			publish();
		},
	};
}
