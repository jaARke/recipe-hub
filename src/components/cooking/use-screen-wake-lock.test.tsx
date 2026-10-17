import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from 'vitest-browser-react';
import { useScreenWakeLock } from '@/components/cooking/use-screen-wake-lock';

function fakeSentinel(): WakeLockSentinel {
	const sentinel = Object.assign(new EventTarget(), {
		released: false,
		type: 'screen' as const,
		onrelease: null,
		release: async () => {
			sentinel.released = true;
		},
	});
	return sentinel;
}

// The browser's wake lock, answering each request when the test says, with a lock the test can let
// go of as the browser does a hidden page's; Chromium and WebKit refuse a real one.
function fakeWakeLock() {
	const unanswered: PromiseWithResolvers<WakeLockSentinel>[] = [];
	const request = vi.spyOn(navigator.wakeLock, 'request').mockImplementation(() => {
		const answer = Promise.withResolvers<WakeLockSentinel>();
		unanswered.push(answer);
		return answer.promise;
	});

	// Grants the oldest request yet unanswered, and returns once the hook, which awaits the request
	// before the test does, has taken the lock.
	async function grant(): Promise<WakeLockSentinel> {
		const answer = unanswered.shift();
		if (answer === undefined) {
			throw new Error('No request to grant');
		}
		answer.resolve(fakeSentinel());
		return answer.promise;
	}

	return { request, grant };
}

// A test cannot hide its own page, so this says it is hidden or shown, as the browser would.
function showPage(visibility: DocumentVisibilityState) {
	vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(visibility);
	document.dispatchEvent(new Event('visibilitychange'));
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe('useScreenWakeLock', () => {
	it('asks again when the page shows after the browser let the lock go on hiding', async () => {
		const wakeLock = fakeWakeLock();
		await renderHook(() => useScreenWakeLock(true));
		const lock = await wakeLock.grant();

		await lock.release();
		showPage('hidden');
		expect(wakeLock.request).toHaveBeenCalledTimes(1);

		showPage('visible');
		expect(wakeLock.request).toHaveBeenCalledTimes(2);
	});

	it('holds one lock however often the page shows, while asking for it and once it is held', async () => {
		const wakeLock = fakeWakeLock();
		await renderHook(() => useScreenWakeLock(true));

		showPage('visible');
		await wakeLock.grant();
		showPage('visible');

		expect(wakeLock.request).toHaveBeenCalledTimes(1);
	});

	it('lets the lock go when it is no longer wanted, and asks for none while unwanted', async () => {
		const wakeLock = fakeWakeLock();
		const { rerender } = await renderHook(({ wanted }: { wanted: boolean } = { wanted: true }) =>
			useScreenWakeLock(wanted)
		);
		const lock = await wakeLock.grant();

		await rerender({ wanted: false });
		expect(lock.released).toBe(true);

		showPage('visible');
		expect(wakeLock.request).toHaveBeenCalledTimes(1);
	});

	it('lets go of a lock granted after it stopped being wanted', async () => {
		const wakeLock = fakeWakeLock();
		const { unmount } = await renderHook(() => useScreenWakeLock(true));
		await unmount();

		const lock = await wakeLock.grant();

		expect(lock.released).toBe(true);
	});
});
