'use client';

import * as React from 'react';
import {
	cookingChecksEntry,
	cookingChecksKey,
	noCookingChecks,
	readCookingChecks,
	type CookingCheckKey,
	type CookingChecksRecipe,
} from '@/components/cooking/cooking-checks';
import { readTabStorage, removeTabStorage, writeTabStorage } from '@/lib/browser-storage';

export type CookingChecks = {
	checked: ReadonlySet<CookingCheckKey>;
	setChecked: (row: CookingCheckKey, checked: boolean) => void;
	// Clears every check, as Start over does.
	clear: () => void;
};

type CookingChecksStore = {
	subscribe: (listener: () => void) => () => void;
	getSnapshot: () => ReadonlySet<CookingCheckKey>;
	update: (change: (checked: ReadonlySet<CookingCheckKey>) => ReadonlySet<CookingCheckKey>) => void;
};

function serverSnapshot(): ReadonlySet<CookingCheckKey> {
	return noCookingChecks;
}

// The recipe's checks, read from the tab's storage the first time the browser asks and written back
// on every change. They are held here too, so where storage is blocked or full the checks still work
// and only go with the page.
function createCookingChecksStore(recipe: CookingChecksRecipe): CookingChecksStore {
	const key = cookingChecksKey(recipe);
	const listeners = new Set<() => void>();
	let checked: ReadonlySet<CookingCheckKey> | undefined;

	function getSnapshot(): ReadonlySet<CookingCheckKey> {
		checked ??= readCookingChecks(readTabStorage(key));
		return checked;
	}

	return {
		subscribe(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		getSnapshot,
		update(change) {
			checked = change(getSnapshot());
			const entry = cookingChecksEntry(checked);
			if (entry === undefined) {
				removeTabStorage(key);
			} else {
				writeTabStorage(key, entry);
			}
			for (const listener of listeners) {
				listener();
			}
		},
	};
}

// The cooking view's checks for one recipe. The server renders none, since a tab's storage is the
// browser's.
export function useCookingChecks(recipe: CookingChecksRecipe): CookingChecks {
	const { id, version } = recipe;
	const store = React.useMemo(() => createCookingChecksStore({ id, version }), [id, version]);
	const checked = React.useSyncExternalStore(store.subscribe, store.getSnapshot, serverSnapshot);

	return React.useMemo<CookingChecks>(
		() => ({
			checked,
			setChecked: (row, check) =>
				store.update((current) => {
					const next = new Set(current);
					if (check) {
						next.add(row);
					} else {
						next.delete(row);
					}
					return next;
				}),
			clear: () => store.update(() => noCookingChecks),
		}),
		[store, checked]
	);
}
