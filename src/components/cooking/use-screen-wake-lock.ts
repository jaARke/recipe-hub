'use client';

import * as React from 'react';

// Keeps the screen on while wanted, through the browser's Screen Wake Lock API: the lock is requested
// when wanted, requested again when the page shows after the browser let it go on hiding, and released
// when no longer wanted or when the page that wants it is left. A browser without the API, or one that
// refuses the lock, leaves the screen to its own sleep setting. Hand-written, since
// react-screen-wake-lock 3.1.1 never released on unmount and let two requests overlap.
export function useScreenWakeLock(wanted: boolean): void {
	React.useEffect(() => {
		if (!wanted || !('wakeLock' in navigator)) {
			return;
		}

		let active = true;
		let requesting = false;
		let sentinel: WakeLockSentinel | undefined;

		async function acquire() {
			// One lock at a time, and none for a hidden page, which the browser refuses.
			const held = sentinel !== undefined && !sentinel.released;
			if (requesting || held || document.visibilityState !== 'visible') {
				return;
			}

			requesting = true;
			try {
				const lock = await navigator.wakeLock.request('screen');
				if (active) {
					sentinel = lock;
				} else {
					void lock.release();
				}
			} catch {
				// Refused, as on low battery; the screen sleeps as the device is set to.
			} finally {
				requesting = false;
			}
		}

		function acquireWhenShown() {
			void acquire();
		}

		void acquire();
		document.addEventListener('visibilitychange', acquireWhenShown);
		return () => {
			active = false;
			document.removeEventListener('visibilitychange', acquireWhenShown);
			void sentinel?.release();
		};
	}, [wanted]);
}
