'use client';

import * as React from 'react';
import { hrefWithParams } from '@/components/recipe/recipe-paths';
import {
	parseRecipeScaleParam,
	withRecipeScaleParam,
} from '@/components/recipe/recipe-scale-params';
import {
	scaleFactor,
	scaleStepperFor,
	scaleStepperValue,
	type RecipeYield,
	type ScaleStepper,
} from '@/domain/recipe/recipe-yield';

export type RecipeScale = {
	recipeYield: RecipeYield | undefined;
	stepper: ScaleStepper;
	// The stepper's value, which the page's URL holds.
	value: number;
	// What the recipe's amounts scale by at the value.
	factor: number;
	// Writes the value, held to the stepper's steps, to the URL in place.
	setValue: (value: number) => void;
};

type RecipeScaleStore = {
	subscribe: (listener: () => void) => () => void;
	getSnapshot: () => number;
	write: (value: number) => void;
};

const RecipeScaleContext = React.createContext<RecipeScale | null>(null);

// The scale in the page's URL, as ?servings=8, read afresh whenever the browser asks and written
// with replaceState, so a reload keeps it and the history gains no entry. Going back or forward
// between the page's own entries, as after a jump to the original, reads it again.
function createRecipeScaleStore(stepper: ScaleStepper): RecipeScaleStore {
	const listeners = new Set<() => void>();

	function getSnapshot(): number {
		return parseRecipeScaleParam(new URLSearchParams(location.search), stepper);
	}

	return {
		subscribe(listener) {
			listeners.add(listener);
			window.addEventListener('popstate', listener);
			return () => {
				listeners.delete(listener);
				window.removeEventListener('popstate', listener);
			};
		},
		getSnapshot,
		write(value) {
			if (scaleStepperValue(stepper, value) === getSnapshot()) {
				return;
			}

			const params = withRecipeScaleParam(new URLSearchParams(location.search), stepper, value);
			window.history.replaceState(
				null,
				'',
				`${hrefWithParams(location.pathname, params)}${location.hash}`
			);
			for (const listener of listeners) {
				listener();
			}
		},
	};
}

// The servings stepper's value for one recipe page, which its ingredients and its header's yield
// follow. The server renders the recipe at its own scale, so the cached page is the same for every
// reader, and the browser reads the URL's scale once the page has hydrated.
function RecipeScaleProvider({
	recipeYield,
	children,
}: {
	recipeYield: RecipeYield | undefined;
	children: React.ReactNode;
}) {
	const stepper = React.useMemo(() => scaleStepperFor(recipeYield), [recipeYield]);
	const store = React.useMemo(() => createRecipeScaleStore(stepper), [stepper]);
	const value = React.useSyncExternalStore(
		store.subscribe,
		store.getSnapshot,
		() => stepper.original
	);

	const scale = React.useMemo<RecipeScale>(
		() => ({
			recipeYield,
			stepper,
			value,
			factor: scaleFactor(stepper, value),
			setValue: store.write,
		}),
		[recipeYield, stepper, value, store]
	);

	return <RecipeScaleContext.Provider value={scale}>{children}</RecipeScaleContext.Provider>;
}

// Null outside a recipe page, where a recipe shows at its own scale without a stepper.
function useRecipeScale(): RecipeScale | null {
	return React.useContext(RecipeScaleContext);
}

export { RecipeScaleProvider, useRecipeScale };
