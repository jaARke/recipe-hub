'use client';

import * as React from 'react';
import { parseCookingStepParam, withCookingStepParam } from '@/components/cooking/cooking-screens';
import { hrefWithParams } from '@/components/recipe/recipe-paths';
import {
	parseRecipeScaleParam,
	withRecipeScaleParam,
} from '@/components/recipe/recipe-scale-params';
import {
	scaleFactor,
	scaleStepperFor,
	type RecipeYield,
	type ScaleStepper,
} from '@/domain/recipe/recipe-yield';

// The cooking view's place in its URL: the screen, as ?step=4, and the scale, as ?servings=12. Each
// is read afresh whenever the browser asks and written with replaceState, so a reload keeps it and
// the history gains no entry, and Back leaves the view.

export type RecipeScale = {
	recipeYield: RecipeYield | undefined;
	stepper: ScaleStepper;
	// The stepper's value, which the URL holds.
	value: number;
	// What the recipe's amounts scale by at the value.
	factor: number;
	// Writes the value, held to the stepper's steps, to the URL in place.
	setValue: (value: number) => void;
};

const listeners = new Set<() => void>();

// Going back or forward to one of the view's entries, as after closing it, reads the URL again.
function subscribe(listener: () => void): () => void {
	listeners.add(listener);
	window.addEventListener('popstate', listener);
	return () => {
		listeners.delete(listener);
		window.removeEventListener('popstate', listener);
	};
}

function readQuery(): string {
	return location.search;
}

// The server renders the view's first screen at the recipe's own scale.
function readNoQuery(): string {
	return '';
}

// Next keeps the view, hidden, behind the page Back leads to, and the browser shows that page's
// address before the view hides: the view takes the query only while the address is its own, and
// keeps the one it showed until it shows again.
function useCookingQuery(pathname: string): URLSearchParams {
	const shownQuery = React.useRef('');
	const readShownQuery = React.useCallback(() => {
		if (location.pathname === pathname) {
			shownQuery.current = readQuery();
		}
		return shownQuery.current;
	}, [pathname]);

	const query = React.useSyncExternalStore(subscribe, readShownQuery, readNoQuery);
	return React.useMemo(() => new URLSearchParams(query), [query]);
}

function replaceCookingQuery(change: (params: URLSearchParams) => URLSearchParams): void {
	const current = new URLSearchParams(location.search);
	const params = change(current);
	if (params.toString() === current.toString()) {
		return;
	}

	window.history.replaceState(
		null,
		'',
		`${hrefWithParams(location.pathname, params)}${location.hash}`
	);
	for (const listener of listeners) {
		listener();
	}
}

// The index of the screen shown, of the recipe's count, and how to show another, in the view at
// pathname.
export function useCookingScreenIndex(
	pathname: string,
	screenCount: number
): [number, (index: number) => void] {
	const index = parseCookingStepParam(useCookingQuery(pathname), screenCount);
	const setIndex = React.useCallback((next: number) => {
		replaceCookingQuery((params) => withCookingStepParam(params, next));
	}, []);
	return [index, setIndex];
}

// The servings stepper's value for the recipe, in the view at pathname, which the checklist, the
// steps' note, and the printout follow.
export function useRecipeScale(
	pathname: string,
	recipeYield: RecipeYield | undefined
): RecipeScale {
	const stepper = React.useMemo(() => scaleStepperFor(recipeYield), [recipeYield]);
	const value = parseRecipeScaleParam(useCookingQuery(pathname), stepper);

	return React.useMemo<RecipeScale>(
		() => ({
			recipeYield,
			stepper,
			value,
			factor: scaleFactor(stepper, value),
			setValue: (next) => {
				replaceCookingQuery((params) => withRecipeScaleParam(params, stepper, next));
			},
		}),
		[recipeYield, stepper, value]
	);
}
