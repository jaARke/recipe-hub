'use client';

import { useMemo, useSyncExternalStore } from 'react';
import {
	openerEntryIndex,
	readRecipeOpenedFrom,
	recipeOpenedFrom,
	recipeOpenedFromKey,
	recipeOpenedFromValue,
	type RecipeOpenedFrom,
} from '@/components/recipe/recipe-opened-from';
import { readTabStorage, writeTabStorage } from '@/lib/browser-storage';

// The parts of the Navigation API read here, which TypeScript's DOM types lack. Every major browser
// has it (Safari since 26.2, Firefox since 147); without it, no recipe was opened from a list.
type TabNavigation = {
	readonly currentEntry: NavigationHistoryEntry | null;
	entries(): NavigationHistoryEntry[];
	addEventListener(type: 'currententrychange', listener: () => void): void;
	removeEventListener(type: 'currententrychange', listener: () => void): void;
};

function tabNavigation(): TabNavigation | undefined {
	return (globalThis as { navigation?: TabNavigation }).navigation;
}

// The history entry the page at the pathname was reached from. None where the current entry is not
// the address shown, as in a browser whose Navigation API misses entries the page pushes.
function openerEntry(
	navigation: TabNavigation,
	pathname: string
): NavigationHistoryEntry | undefined {
	const current = navigation.currentEntry;
	if (current === null || current.url !== location.href) {
		return undefined;
	}
	const entries = navigation.entries();
	const index = openerEntryIndex(
		entries.map(({ url }) => url),
		current.index,
		pathname
	);
	return index === undefined ? undefined : entries[index];
}

// What this tab keeps for where the recipe at the pathname was opened from, when its list's page is
// the entry the recipe's page was reached from. Returned as the string stored, so the snapshot
// compares equal until it changes.
function readRecipeOpenedFromValue(recipePathname: string): string | undefined {
	const navigation = tabNavigation();
	if (navigation === undefined) {
		return undefined;
	}
	const value = readTabStorage(recipeOpenedFromKey(recipePathname));
	return recipeOpenedFrom(value, openerEntry(navigation, recipePathname)?.url) === undefined
		? undefined
		: value;
}

// Next writes a navigation's history entry in an insertion effect, where React allows no update, and
// the browser reports the new entry at once; so the change is passed on once that commit is done.
function subscribeToHistory(onChange: () => void): () => void {
	const navigation = tabNavigation();
	let subscribed = true;
	const onEntryChange = () =>
		queueMicrotask(() => {
			if (subscribed) {
				onChange();
			}
		});
	navigation?.addEventListener('currententrychange', onEntryChange);
	return () => {
		subscribed = false;
		navigation?.removeEventListener('currententrychange', onEntryChange);
	};
}

// Records this page, by its full URL, with the label of the recipe's link back to it, as where the
// recipe at the pathname is opened from, as a link to it is followed in this tab.
export function recordRecipeOpened(recipePathname: string, backLabel: string): void {
	writeTabStorage(
		recipeOpenedFromKey(recipePathname),
		recipeOpenedFromValue({ url: location.href, backLabel })
	);
}

// Goes back in the tab's history to the list page the recipe was opened from, so it returns as it
// was left, at its scroll position. False when that entry is no longer the one the recipe was
// reached from.
export function returnToRecipeList(recipePathname: string, url: string): boolean {
	const navigation = tabNavigation();
	const current = navigation?.currentEntry;
	const entry = navigation === undefined ? undefined : openerEntry(navigation, recipePathname);
	if (current == null || entry === undefined || entry.url !== url) {
		return false;
	}
	history.go(entry.index - current.index);
	return true;
}

// The list the recipe at the pathname was opened from, or undefined on any other page. The server's
// render and hydration read none, since a recipe's page is prerendered for every reader.
export function useRecipeOpenedFrom(pathname: string | undefined): RecipeOpenedFrom | undefined {
	const value = useSyncExternalStore(
		subscribeToHistory,
		() => (pathname === undefined ? undefined : readRecipeOpenedFromValue(pathname)),
		() => undefined
	);
	return useMemo(() => readRecipeOpenedFrom(value), [value]);
}
