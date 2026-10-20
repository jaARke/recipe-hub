'use client';

import * as React from 'react';

// How many of the Recipes page's loading states show. Next ends a navigation as the page's skeletons
// show, before its results stream in, so the header's search waits on this to know when they have.
let shownCount = 0;

const listeners = new Set<() => void>();

function changeShownCount(change: number) {
	shownCount += change;
	for (const listener of listeners) {
		listener();
	}
}

// Calls back once no loading state of the Recipes page shows, at once when none does. Returns a
// function that stops waiting.
export function whenRecipeResultsShown(callback: () => void): () => void {
	if (shownCount === 0) {
		callback();
		return () => {};
	}
	// Read once the commit that changed the count is done, since Strict Mode, as the dev server runs,
	// takes a new loading state away and gives it back within one.
	const listener = () => {
		queueMicrotask(() => {
			if (shownCount === 0 && listeners.delete(listener)) {
				callback();
			}
		});
	};
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

// Marks a loading state of the Recipes page, such as its results' Suspense fallback, while it shows.
// Marked as it commits, before any effect of that commit reads it, and unmarked as it goes, which a
// page Next hides takes with it.
export function RecipeResultsLoading() {
	React.useLayoutEffect(() => {
		changeShownCount(1);
		return () => changeShownCount(-1);
	}, []);

	return null;
}
