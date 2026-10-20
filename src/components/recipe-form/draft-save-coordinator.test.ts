import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	createDraftSaveCoordinator,
	type DraftDeleteOutcome,
	type DraftRequests,
	type DraftSaveOutcome,
	type DraftVersion,
} from '@/components/recipe-form/draft-save-coordinator';

// The coordinator's debounce and its bound on a request, as written beside them.
const debounceMs = 1_000;
const timeLimitMs = 30_000;

const firstSave: DraftVersion = { id: 'draft-1', savedAt: new Date('2026-10-19T12:00:00.000Z') };
const secondSave: DraftVersion = { id: 'draft-1', savedAt: new Date('2026-10-19T12:00:05.000Z') };
const otherDraft: DraftVersion = { id: 'draft-2', savedAt: new Date('2026-10-19T12:01:00.000Z') };

type SaveCall = {
	kind: 'save';
	content: string;
	held: DraftVersion | undefined;
	answer: PromiseWithResolvers<DraftSaveOutcome>;
};

type DeleteCall = {
	kind: 'delete';
	held: DraftVersion;
	answer: PromiseWithResolvers<DraftDeleteOutcome>;
};

// A server whose requests answer only when the test says, or never.
function stalledServer() {
	const calls: (SaveCall | DeleteCall)[] = [];
	const requests: DraftRequests<string> = {
		save(content, held) {
			const answer = Promise.withResolvers<DraftSaveOutcome>();
			calls.push({ kind: 'save', content, held, answer });
			return answer.promise;
		},
		delete(held) {
			const answer = Promise.withResolvers<DraftDeleteOutcome>();
			calls.push({ kind: 'delete', held, answer });
			return answer.promise;
		},
	};
	const call = (index: number) => {
		const found = calls[index];
		if (found === undefined) {
			throw new Error(`No request ${index} was sent`);
		}
		return found;
	};
	return {
		requests,
		// What each request sent, in order.
		sent: () =>
			calls.map((made) =>
				made.kind === 'save'
					? { kind: 'save', content: made.content, held: made.held?.id }
					: { kind: 'delete', held: made.held.id, version: made.held.savedAt }
			),
		saved(index: number, draft: DraftVersion) {
			(call(index).answer as SaveCall['answer']).resolve({ status: 'saved', draft });
		},
		deleted(index: number) {
			(call(index).answer as DeleteCall['answer']).resolve({ status: 'deleted' });
		},
		refused(index: number, message: string, stopsSaving: boolean) {
			call(index).answer.resolve({ status: 'refused', message, stopsSaving });
		},
		unreachable(index: number) {
			call(index).answer.reject(new TypeError('Failed to fetch'));
		},
	};
}

// A form's text, empty when blank.
function coordinatorFor(
	server: ReturnType<typeof stalledServer>,
	opened?: { draft: DraftVersion; content: string }
) {
	return createDraftSaveCoordinator<string>({
		requests: server.requests,
		opened: opened?.draft,
		initial: opened?.content ?? '',
		empty: '',
		same: (a, b) => a.trim() === b.trim(),
	});
}

beforeEach(() => {
	vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});

afterEach(() => {
	vi.useRealTimers();
});

describe('createDraftSaveCoordinator', () => {
	it('starts empty, or saved for a draft it opens', () => {
		const server = stalledServer();

		expect(coordinatorFor(server).getSnapshot()).toEqual({
			held: undefined,
			saved: '',
			status: { kind: 'empty' },
		});
		expect(
			coordinatorFor(server, { draft: firstSave, content: 'Lemon bars' }).getSnapshot()
		).toEqual({ held: firstSave, saved: 'Lemon bars', status: { kind: 'saved' } });
	});

	it('saves a debounce after the last change, once, and then holds the draft', async () => {
		const server = stalledServer();
		const coordinator = coordinatorFor(server);

		coordinator.change('L');
		await vi.advanceTimersByTimeAsync(debounceMs - 1);
		coordinator.change('Le');
		await vi.advanceTimersByTimeAsync(debounceMs - 1);
		expect(server.sent()).toEqual([]);
		expect(coordinator.getSnapshot().status).toEqual({ kind: 'saving' });

		await vi.advanceTimersByTimeAsync(1);
		expect(server.sent()).toEqual([{ kind: 'save', content: 'Le', held: undefined }]);
		server.saved(0, firstSave);
		await vi.advanceTimersByTimeAsync(0);

		expect(coordinator.getSnapshot()).toEqual({
			held: firstSave,
			saved: 'Le',
			status: { kind: 'saved' },
		});
	});

	it('sends nothing for a change that shows the same, or one changed back before the debounce', async () => {
		const server = stalledServer();
		const coordinator = coordinatorFor(server, { draft: firstSave, content: 'Lemon bars' });

		coordinator.change('Lemon bars ');
		coordinator.change('Lemon bars!');
		coordinator.change('Lemon bars');
		await vi.advanceTimersByTimeAsync(debounceMs);

		expect(server.sent()).toEqual([]);
		expect(coordinator.getSnapshot().status).toEqual({ kind: 'saved' });
	});

	it('keeps one draft when a slow first save has typing during it, and saves the latest over it', async () => {
		const server = stalledServer();
		const coordinator = coordinatorFor(server);
		coordinator.change('L');
		await vi.advanceTimersByTimeAsync(debounceMs);

		// Typed while the first save is in flight, past the debounce each time.
		coordinator.change('Le');
		await vi.advanceTimersByTimeAsync(debounceMs);
		coordinator.change('Lemon');
		await vi.advanceTimersByTimeAsync(debounceMs);
		coordinator.change('Lemon bars');
		await vi.advanceTimersByTimeAsync(debounceMs * 5);
		expect(server.sent()).toEqual([{ kind: 'save', content: 'L', held: undefined }]);

		server.saved(0, firstSave);
		await vi.advanceTimersByTimeAsync(0);
		expect(server.sent()).toEqual([
			{ kind: 'save', content: 'L', held: undefined },
			{ kind: 'save', content: 'Lemon bars', held: 'draft-1' },
		]);
		server.saved(1, secondSave);
		await vi.advanceTimersByTimeAsync(0);

		expect(coordinator.getSnapshot()).toEqual({
			held: secondSave,
			saved: 'Lemon bars',
			status: { kind: 'saved' },
		});
	});

	it('sends a request only once the one before it settles, so an earlier save never lands after a later one', async () => {
		const server = stalledServer();
		const coordinator = coordinatorFor(server, { draft: firstSave, content: 'Lemon bars' });
		coordinator.change('Lemon squares');
		await vi.advanceTimersByTimeAsync(debounceMs);
		coordinator.change('Lemon tart');
		coordinator.flush();

		expect(server.sent()).toEqual([{ kind: 'save', content: 'Lemon squares', held: 'draft-1' }]);
		server.saved(0, secondSave);
		await vi.advanceTimersByTimeAsync(0);

		// The later save names the version the earlier one made.
		expect(server.sent()).toEqual([
			{ kind: 'save', content: 'Lemon squares', held: 'draft-1' },
			{ kind: 'save', content: 'Lemon tart', held: 'draft-1' },
		]);
		expect(coordinator.getSnapshot().held).toBe(secondSave);
	});

	it('deletes the draft held at its version once the form is emptied, and saves a new one after', async () => {
		const server = stalledServer();
		const coordinator = coordinatorFor(server, { draft: firstSave, content: 'Lemon bars' });

		coordinator.change('');
		await vi.advanceTimersByTimeAsync(debounceMs);
		expect(server.sent()).toEqual([
			{ kind: 'delete', held: 'draft-1', version: firstSave.savedAt },
		]);
		server.deleted(0);
		await vi.advanceTimersByTimeAsync(0);
		expect(coordinator.getSnapshot()).toEqual({
			held: undefined,
			saved: '',
			status: { kind: 'deleted' },
		});

		coordinator.change('Lemon squares');
		await vi.advanceTimersByTimeAsync(debounceMs);
		expect(server.sent()[1]).toEqual({ kind: 'save', content: 'Lemon squares', held: undefined });
		server.saved(1, otherDraft);
		await vi.advanceTimersByTimeAsync(0);
		expect(coordinator.getSnapshot()).toEqual({
			held: otherDraft,
			saved: 'Lemon squares',
			status: { kind: 'saved' },
		});
	});

	it('keeps no draft for a form emptied before its first save', async () => {
		const server = stalledServer();
		const coordinator = coordinatorFor(server);

		coordinator.change('L');
		coordinator.change('');
		await vi.advanceTimersByTimeAsync(debounceMs);

		expect(server.sent()).toEqual([]);
		expect(coordinator.getSnapshot().status).toEqual({ kind: 'empty' });
	});

	it('says a delete another page’s save refused, and stops saving for good', async () => {
		const server = stalledServer();
		const coordinator = coordinatorFor(server, { draft: firstSave, content: 'Lemon bars' });
		coordinator.change('');
		await vi.advanceTimersByTimeAsync(debounceMs);

		server.refused(0, 'Saved somewhere else', true);
		await vi.advanceTimersByTimeAsync(0);
		coordinator.change('Lemon squares');
		await vi.advanceTimersByTimeAsync(debounceMs);

		expect(server.sent()).toHaveLength(1);
		expect(coordinator.getSnapshot()).toEqual({
			held: firstSave,
			saved: 'Lemon bars',
			status: { kind: 'refused', message: 'Saved somewhere else' },
		});
		await expect(coordinator.settle()).resolves.toEqual({
			held: firstSave,
			current: false,
			halted: true,
		});
	});

	it('tries a save refused at a place in the form again with the next change', async () => {
		const server = stalledServer();
		const coordinator = coordinatorFor(server);
		coordinator.change('Lemon bars');
		await vi.advanceTimersByTimeAsync(debounceMs);

		server.refused(0, 'The draft wasn’t saved.', false);
		await vi.advanceTimersByTimeAsync(0);
		expect(coordinator.getSnapshot().status).toEqual({
			kind: 'refused',
			message: 'The draft wasn’t saved.',
		});
		coordinator.change('Lemon bars, no photo');
		await vi.advanceTimersByTimeAsync(debounceMs);

		expect(server.sent()[1]).toEqual({
			kind: 'save',
			content: 'Lemon bars, no photo',
			held: undefined,
		});
	});

	it('says a save that never reached the site failed, and tries again with the next change', async () => {
		const server = stalledServer();
		const coordinator = coordinatorFor(server);
		coordinator.change('Lemon bars');
		await vi.advanceTimersByTimeAsync(debounceMs);

		server.unreachable(0);
		await vi.advanceTimersByTimeAsync(debounceMs * 10);
		expect(server.sent()).toHaveLength(1);
		expect(coordinator.getSnapshot().status).toEqual({ kind: 'unreachable' });

		coordinator.change('Lemon bars!');
		expect(coordinator.getSnapshot().status).toEqual({ kind: 'saving' });
		await vi.advanceTimersByTimeAsync(debounceMs);
		expect(server.sent()[1]).toEqual({ kind: 'save', content: 'Lemon bars!', held: undefined });
		server.saved(1, firstSave);
		await vi.advanceTimersByTimeAsync(0);
		expect(coordinator.getSnapshot().status).toEqual({ kind: 'saved' });
	});

	it('gives up waiting on a request at its bound, sends nothing until it lands, then goes on from it', async () => {
		const server = stalledServer();
		const coordinator = coordinatorFor(server);
		coordinator.change('L');
		await vi.advanceTimersByTimeAsync(debounceMs);

		await vi.advanceTimersByTimeAsync(timeLimitMs - debounceMs - 1);
		expect(coordinator.getSnapshot().status).toEqual({ kind: 'saving' });
		await vi.advanceTimersByTimeAsync(debounceMs + 1);
		expect(coordinator.getSnapshot().status).toEqual({ kind: 'unreachable' });

		// What is typed now waits for the request, which may have made the draft.
		coordinator.change('Lemon bars');
		await vi.advanceTimersByTimeAsync(debounceMs);
		await expect(coordinator.settle()).resolves.toEqual({
			held: undefined,
			current: false,
			halted: false,
		});
		expect(server.sent()).toHaveLength(1);

		server.saved(0, firstSave);
		await vi.advanceTimersByTimeAsync(0);
		expect(server.sent()).toEqual([
			{ kind: 'save', content: 'L', held: undefined },
			{ kind: 'save', content: 'Lemon bars', held: 'draft-1' },
		]);
	});

	it('settles by sending what waits and then saying the draft holds it', async () => {
		const server = stalledServer();
		const coordinator = coordinatorFor(server);
		coordinator.change('Lemon bars');

		const settled = coordinator.settle();
		expect(server.sent()).toEqual([{ kind: 'save', content: 'Lemon bars', held: undefined }]);
		server.saved(0, firstSave);

		await expect(settled).resolves.toEqual({ held: firstSave, current: true, halted: false });
	});

	it('settles after a failed save by trying it again', async () => {
		const server = stalledServer();
		const coordinator = coordinatorFor(server);
		coordinator.change('Lemon bars');
		await vi.advanceTimersByTimeAsync(debounceMs);
		server.unreachable(0);
		await vi.advanceTimersByTimeAsync(0);

		const settled = coordinator.settle();
		expect(server.sent()).toHaveLength(2);
		server.unreachable(1);

		await expect(settled).resolves.toEqual({ held: undefined, current: false, halted: false });
	});

	it('settles at once with nothing to send', async () => {
		const server = stalledServer();

		await expect(coordinatorFor(server).settle()).resolves.toEqual({
			held: undefined,
			current: true,
			halted: false,
		});
		expect(server.sent()).toEqual([]);
	});

	it('stops for adding while a first save is in flight, so adding names the draft it makes', async () => {
		const server = stalledServer();
		const coordinator = coordinatorFor(server);
		coordinator.change('L');
		await vi.advanceTimersByTimeAsync(debounceMs);
		coordinator.change('Lemon bars');

		const stopped = coordinator.stop();
		server.saved(0, firstSave);

		await expect(stopped).resolves.toEqual(firstSave);
		await vi.advanceTimersByTimeAsync(debounceMs * 5);
		expect(server.sent()).toEqual([{ kind: 'save', content: 'L', held: undefined }]);
	});

	it('stops for deleting before a debounce ends, sending nothing', async () => {
		const server = stalledServer();
		const coordinator = coordinatorFor(server, { draft: firstSave, content: 'Lemon bars' });
		coordinator.change('Lemon squares');

		await expect(coordinator.stop()).resolves.toEqual(firstSave);
		coordinator.change('Lemon tart');
		await vi.advanceTimersByTimeAsync(debounceMs * 5);

		expect(server.sent()).toEqual([]);
	});

	it('stops at once once a request outlasts its bound', async () => {
		const server = stalledServer();
		const coordinator = coordinatorFor(server);
		coordinator.change('L');
		await vi.advanceTimersByTimeAsync(debounceMs + timeLimitMs);

		await expect(coordinator.stop()).resolves.toBeUndefined();
	});

	it('saves what the form shows once it resumes after adding failed', async () => {
		const server = stalledServer();
		const coordinator = coordinatorFor(server, { draft: firstSave, content: 'Lemon bars' });
		await coordinator.stop();
		coordinator.change('Lemon squares');

		coordinator.resume();

		expect(server.sent()).toEqual([{ kind: 'save', content: 'Lemon squares', held: 'draft-1' }]);
	});

	it('tells its listeners only when what it shares changes', async () => {
		const server = stalledServer();
		const coordinator = coordinatorFor(server);
		const listener = vi.fn();
		coordinator.subscribe(listener);
		const before = coordinator.getSnapshot();

		coordinator.change('L');
		coordinator.change('Le');
		expect(listener).toHaveBeenCalledOnce();
		expect(coordinator.getSnapshot()).not.toBe(before);
		const saving = coordinator.getSnapshot();
		await vi.advanceTimersByTimeAsync(debounceMs);

		expect(coordinator.getSnapshot()).toBe(saving);
	});
});
