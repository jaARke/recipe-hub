import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useScreenWakeLock } from '@/components/cooking/use-screen-wake-lock';

type FakeSentinel = { released: boolean; release: () => Promise<void> };

// A wake lock the browser grants on request and lets go of as a hidden page's is, counting both.
function fakeWakeLock() {
	const sentinels: FakeSentinel[] = [];
	const request = vi.fn(async () => {
		const sentinel: FakeSentinel = {
			released: false,
			release: async () => {
				sentinel.released = true;
			},
		};
		sentinels.push(sentinel);
		return sentinel;
	});
	Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
	return { request, sentinels };
}

function showPage(visibility: DocumentVisibilityState) {
	Object.defineProperty(document, 'visibilityState', { value: visibility, configurable: true });
	document.dispatchEvent(new Event('visibilitychange'));
}

afterEach(() => {
	Reflect.deleteProperty(navigator, 'wakeLock');
	Reflect.deleteProperty(document, 'visibilityState');
});

describe('useScreenWakeLock', () => {
	it('asks again when the page shows after the browser let the lock go on hiding', async () => {
		const { request, sentinels } = fakeWakeLock();
		renderHook(() => useScreenWakeLock(true));
		await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1));

		await act(async () => {
			await sentinels[0]?.release();
			showPage('hidden');
		});
		expect(request).toHaveBeenCalledTimes(1);

		await act(async () => showPage('visible'));
		expect(request).toHaveBeenCalledTimes(2);
	});

	it('holds one lock however often the page shows while it is held', async () => {
		const { request } = fakeWakeLock();
		renderHook(() => useScreenWakeLock(true));

		await act(async () => {
			showPage('visible');
			showPage('visible');
		});
		expect(request).toHaveBeenCalledTimes(1);
	});

	it('lets the lock go when it is no longer wanted, and asks for none while unwanted', async () => {
		const { request, sentinels } = fakeWakeLock();
		const { rerender } = renderHook(({ wanted }) => useScreenWakeLock(wanted), {
			initialProps: { wanted: true },
		});
		await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1));

		rerender({ wanted: false });
		expect(sentinels[0]?.released).toBe(true);

		await act(async () => showPage('visible'));
		expect(request).toHaveBeenCalledTimes(1);
	});

	it('lets go of a lock granted after it stopped being wanted', async () => {
		const { request, sentinels } = fakeWakeLock();
		const { unmount } = renderHook(() => useScreenWakeLock(true));
		unmount();

		await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1));
		await vi.waitFor(() => expect(sentinels[0]?.released).toBe(true));
	});

	it('leaves the screen alone where the browser has no wake lock', () => {
		expect(() => renderHook(() => useScreenWakeLock(true))).not.toThrow();
	});
});
