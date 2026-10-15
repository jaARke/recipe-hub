import { z } from 'zod';
import type { PublicRecipeDto } from '@/application/recipes/recipe-dtos';

// The cooking view's screens: Gather your ingredients, one per step across every section, and the
// finish. A screen's index is its step's number, which the URL's step parameter holds, so ?step=4
// is step 4. Pure, so the rules are tested without a browser.

// What the cooking view shows of a recipe, at the version its page shows: when it was last edited.
export type CookingRecipe = Pick<
	PublicRecipeDto,
	'id' | 'slug' | 'title' | 'yield' | 'notes' | 'ingredientSections' | 'instructionSections'
> & {
	version: string;
};

export type CookingStepScreen = {
	kind: 'step';
	// Counted from 1 across every section.
	number: number;
	sectionIndex: number;
	sectionHeading?: string;
	text: string;
};

export type CookingScreen = { kind: 'gather' } | CookingStepScreen | { kind: 'finish' };

export const cookingStepParamName = 'step';

// A screen past the first, written as a step is numbered: "4", never "04" or "0".
const stepParamSchema = z
	.string()
	.regex(/^[1-9]\d*$/u)
	.transform(Number);

export function cookingRecipeFrom(recipe: PublicRecipeDto): CookingRecipe {
	return {
		id: recipe.id,
		slug: recipe.slug,
		title: recipe.title,
		yield: recipe.yield,
		notes: recipe.notes,
		ingredientSections: recipe.ingredientSections,
		instructionSections: recipe.instructionSections,
		version: recipe.updatedAt.toISOString(),
	};
}

export function cookingScreens(
	instructionSections: CookingRecipe['instructionSections']
): CookingScreen[] {
	const steps: CookingStepScreen[] = [];
	instructionSections.forEach((section, sectionIndex) => {
		for (const step of section.steps) {
			steps.push({
				kind: 'step',
				number: steps.length + 1,
				sectionIndex,
				sectionHeading: section.heading,
				text: step.text,
			});
		}
	});
	return [{ kind: 'gather' }, ...steps, { kind: 'finish' }];
}

// Whether the screen opens a group of its own on the progress rail, so the rail draws the recipe's
// shape: Gather, then the steps of each section.
export function startsCookingGroup(screens: readonly CookingScreen[], index: number): boolean {
	const screen = screens[index];
	const previous = screens[index - 1];
	if (screen === undefined || previous === undefined) {
		return false;
	}
	return (
		screen.kind !== previous.kind ||
		(screen.kind === 'step' &&
			previous.kind === 'step' &&
			screen.sectionIndex !== previous.sectionIndex)
	);
}

// The first screen's title; it shows as step 0, the one before the recipe's first.
export const gatherTitle = 'Gather your ingredients';

// The Gather screen's heading as a screen reader reads it: "Gather your ingredients, step 0 of 10".
export function cookingGatherHeading(stepCount: number): string {
	return `${gatherTitle}, step 0 of ${stepCount}`;
}

// A step screen's heading as a screen reader reads it, its section first as the screen shows it.
export function cookingStepHeading(step: CookingStepScreen, stepCount: number): string {
	const position = `${step.number} of ${stepCount}`;
	return step.sectionHeading === undefined
		? `Step ${position}`
		: `${step.sectionHeading}, step ${position}`;
}

// Next is named for its move; the finish screen has none, only its way back to the recipe.
export function cookingNextLabel(
	screens: readonly CookingScreen[],
	index: number
): string | undefined {
	switch (screens[index]?.kind) {
		case 'gather':
			return 'Start cooking';
		case 'step':
			return screens[index + 1]?.kind === 'finish' ? 'Finish' : 'Next step';
		default:
			return undefined;
	}
}

// What the view says when it opens on the screen, as on a reload mid-cook; nothing on Gather, where
// every cook starts.
export function cookingResumedText(screen: CookingScreen | undefined): string | undefined {
	switch (screen?.kind) {
		case 'step':
			return `Picked up at step ${screen.number}, where you left off.`;
		case 'finish':
			return 'Picked up at the end, where you left off.';
		default:
			return undefined;
	}
}

// Exactly one number naming a screen past the first; anything else, or a screen the recipe does not
// have, opens Gather.
export function parseCookingStepParam(
	searchParams: Pick<URLSearchParams, 'getAll'>,
	screenCount: number
): number {
	const values = searchParams.getAll(cookingStepParamName);
	const parsed = values.length === 1 ? stepParamSchema.safeParse(values[0]) : undefined;
	return parsed?.success === true && parsed.data < screenCount ? parsed.data : 0;
}

// The view's parameters with the screen's set, or left out on Gather so the view opens on one URL.
export function withCookingStepParam(
	searchParams: URLSearchParams,
	screenIndex: number
): URLSearchParams {
	const params = new URLSearchParams(searchParams);
	if (screenIndex === 0) {
		params.delete(cookingStepParamName);
	} else {
		params.set(cookingStepParamName, String(screenIndex));
	}
	return params;
}
