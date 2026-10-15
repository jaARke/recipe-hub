'use client';

import * as React from 'react';
import {
	cookingOff,
	cookingProgressEntry,
	cookingProgressKey,
	cookingProgressKeyPrefix,
	cookingProgressSavedAt,
	hasCookingProgressExpired,
	isStaleCookingProgress,
	readCookingProgress,
	type CookingProgress,
	type CookingRecipe,
	type CookingRowKey,
} from '@/components/cooking/cooking-progress';
import { useScreenWakeLock } from '@/components/cooking/use-screen-wake-lock';
import {
	readBrowserStorage,
	removeBrowserStorage,
	removeBrowserStorageWhere,
	writeBrowserStorage,
} from '@/lib/browser-storage';

export type CookingMode = {
	progress: CookingProgress;
	setOn: (on: boolean) => void;
	setChecked: (row: CookingRowKey, checked: boolean) => void;
	startOver: () => void;
};

type CookingProgressStore = {
	subscribe: (listener: () => void) => () => void;
	getSnapshot: () => CookingProgress;
	update: (change: (progress: CookingProgress) => CookingProgress) => void;
};

const CookingModeContext = React.createContext<CookingMode | null>(null);

function serverSnapshot(): CookingProgress {
	return cookingOff;
}

// The recipe's progress, read from this device's storage the first time the browser asks and written
// back on every change. It is held here too, so where storage is blocked or full cooking mode still
// works and only forgets its progress with the page; held progress still expires on time, checked
// when the page shows again (as when Next shows a kept recipe or a phone wakes its tab) and before a
// change.
function createCookingProgressStore(recipe: CookingRecipe): CookingProgressStore {
	const key = cookingProgressKey(recipe.id);
	const listeners = new Set<() => void>();
	let progress: CookingProgress | undefined;
	// When the held progress last changed; undefined while nothing is kept.
	let savedAt: Date | undefined;

	function notify() {
		for (const listener of listeners) {
			listener();
		}
	}

	function getSnapshot(): CookingProgress {
		if (progress === undefined) {
			const entry = readBrowserStorage(key);
			const now = new Date();
			const stored = readCookingProgress(entry, recipe, now);
			// An entry that expired, or was kept for an earlier version of the recipe, is of no use.
			if (stored === undefined && entry !== undefined) {
				removeBrowserStorage(key);
			}
			progress = stored ?? cookingOff;
			savedAt = stored === undefined ? undefined : cookingProgressSavedAt(entry, now);
		}
		return progress;
	}

	// Lets go of held progress that has outlived its lifetime; true when it did.
	function expire(): boolean {
		if (savedAt === undefined || !hasCookingProgressExpired(savedAt, new Date())) {
			return false;
		}
		progress = cookingOff;
		savedAt = undefined;
		removeBrowserStorage(key);
		return true;
	}

	function expireWhenShown() {
		if (document.visibilityState === 'visible' && expire()) {
			notify();
		}
	}

	return {
		subscribe(listener) {
			// React reads the snapshot again once subscribed, so what expires here shows at once.
			expire();
			listeners.add(listener);
			document.addEventListener('visibilitychange', expireWhenShown);
			return () => {
				listeners.delete(listener);
				document.removeEventListener('visibilitychange', expireWhenShown);
			};
		},
		getSnapshot,
		update(change) {
			expire();
			progress = change(getSnapshot());
			const now = new Date();
			const entry = cookingProgressEntry(progress, recipe, now);
			if (entry === undefined) {
				removeBrowserStorage(key);
				savedAt = undefined;
			} else {
				writeBrowserStorage(key, entry);
				savedAt = now;
			}
			notify();
		},
	};
}

// Cooking mode for one recipe page: its switch, its checked rows, and the screen kept on while it is
// on. The server renders it off with nothing checked, so the cached page holds no reader's progress,
// and the browser shows what this device kept once the page has hydrated.
function CookingModeProvider({
	recipe,
	children,
}: {
	recipe: CookingRecipe;
	children: React.ReactNode;
}) {
	const { id, version } = recipe;
	const store = React.useMemo(() => createCookingProgressStore({ id, version }), [id, version]);
	const progress = React.useSyncExternalStore(store.subscribe, store.getSnapshot, serverSnapshot);
	useScreenWakeLock(progress.on);

	// Expired progress for recipes this device never opens again is let go whenever any recipe is.
	React.useEffect(() => {
		removeBrowserStorageWhere(cookingProgressKeyPrefix, (entry) =>
			isStaleCookingProgress(entry, new Date())
		);
	}, []);

	const cookingMode = React.useMemo<CookingMode>(
		() => ({
			progress,
			setOn: (on) => store.update((current) => ({ ...current, on })),
			setChecked: (row, checked) =>
				store.update((current) => {
					const rows = new Set(current.checked);
					if (checked) {
						rows.add(row);
					} else {
						rows.delete(row);
					}
					return { ...current, checked: rows };
				}),
			startOver: () => store.update((current) => ({ ...current, checked: new Set() })),
		}),
		[store, progress]
	);

	return <CookingModeContext.Provider value={cookingMode}>{children}</CookingModeContext.Provider>;
}

// Null outside a recipe page, where ingredients and steps render without cooking mode.
function useCookingMode(): CookingMode | null {
	return React.useContext(CookingModeContext);
}

export { CookingModeProvider, useCookingMode };
