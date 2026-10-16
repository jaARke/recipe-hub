import { z } from 'zod';
import {
	scaleStepperValue,
	type ScaleStepper,
	type ScaleStepperKind,
} from '@/domain/recipe/recipe-yield';

// The cooking view's URL parameter holding the recipe's scale, named by what the stepper counts.
export const recipeScaleParamNames = {
	servings: 'servings',
	makes: 'makes',
	batches: 'batches',
} as const satisfies Record<ScaleStepperKind, string>;

// A positive number written plainly, as the stepper writes one: "8", "1.5".
const scaleParamSchema = z
	.string()
	.regex(/^\d+(?:\.\d+)?$/u)
	.transform(Number)
	.pipe(z.number().positive());

// Exactly one positive number names the scale, held to the stepper's steps and bounds as a typed
// value is; a missing, repeated, or other value, zero included, leaves the recipe at its own scale.
export function parseRecipeScaleParam(
	searchParams: Pick<URLSearchParams, 'getAll'>,
	stepper: ScaleStepper
): number {
	const values = searchParams.getAll(recipeScaleParamNames[stepper.kind]);
	const parsed = values.length === 1 ? scaleParamSchema.safeParse(values[0]) : undefined;
	return parsed?.success === true ? scaleStepperValue(stepper, parsed.data) : stepper.original;
}

// The view's parameters with the scale's set, or left out at the recipe's own scale so the unscaled
// recipe has one URL.
export function withRecipeScaleParam(
	searchParams: URLSearchParams,
	stepper: ScaleStepper,
	value: number
): URLSearchParams {
	const params = new URLSearchParams(searchParams);
	const name = recipeScaleParamNames[stepper.kind];
	const scale = scaleStepperValue(stepper, value);
	if (scale === stepper.original) {
		params.delete(name);
	} else {
		params.set(name, String(scale));
	}

	return params;
}
