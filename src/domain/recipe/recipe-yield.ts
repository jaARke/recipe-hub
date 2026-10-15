import { z } from 'zod';
import { amountSchema, type Amount } from '@/domain/recipe/amount';
import { formatAmount } from '@/domain/recipe/amount-format';
import type { ContentLimits } from '@/domain/recipe/content-limits';
import { parseAmountText, withoutClosingPunctuation } from '@/domain/recipe/ingredient-parser';
import { itemForAmount, scaleCount } from '@/domain/recipe/ingredient-scaling';
import { plainTextSchema, sentenceCase } from '@/domain/text';
import { withoutTrailingPunctuation } from '@/domain/text-normalization';
import { settings } from '@/lib/settings';

// Punctuation that only ends a yield, as in "Serves 4." or "Makes 12 cookies." A question mark is a
// transcription marker, so it stays.
const yieldEndPunctuation = '.,;:';

// What a recipe makes, without the punctuation that ends the yield: "cookies." is "cookies", and an
// abbreviated unit keeps its period, as in "2 doz.". Text of nothing else keeps it, so it is never
// left blank once it passed as text.
export const yieldUnitTextSchema = plainTextSchema.overwrite(
	(text) => withoutClosingPunctuation(text, yieldEndPunctuation) || text
);

export function recipeYieldSchemaFor(limits: ContentLimits) {
	return z.discriminatedUnion('kind', [
		z.object({ kind: z.literal('servings'), amount: amountSchema }),
		z.object({
			kind: z.literal('makes'),
			amount: amountSchema,
			unit: limits.text(settings.recipeLimits.maxYieldUnitLength, yieldUnitTextSchema).optional(),
		}),
	]);
}
export type RecipeYield = z.infer<ReturnType<typeof recipeYieldSchemaFor>>;

// The amount a yield's text gives, as the form's yield field and an import read it: "4." is 4.
export function readYieldAmount(text: string): Amount | undefined {
	return parseAmountText(withoutTrailingPunctuation(text, yieldEndPunctuation));
}

// The yield at a scale, counted as ingredients without a unit are: "Serves 4 to 6" doubles to
// "Serves 8 to 12", and what it makes takes the number its count takes, as an item does.
export function scaleYield(recipeYield: RecipeYield, factor: number): RecipeYield {
	if (factor === 1) {
		return recipeYield;
	}

	const amount = scaleCount(recipeYield.amount, factor);
	if (recipeYield.kind === 'makes' && recipeYield.unit !== undefined) {
		return {
			...recipeYield,
			amount,
			unit: itemForAmount(recipeYield.unit, recipeYield.amount, amount),
		};
	}

	return { ...recipeYield, amount };
}

// The servings stepper counts what the yield counts: servings by one, what a recipe makes by half an
// even count ("Makes 24 cookies" steps 12, 24, 36) or by a whole odd one ("Makes 15" steps 15, 30), so
// every count shown is whole, and anything else (a range, a count that is not whole, or no yield) in
// batches by half.
export type ScaleStepperKind = 'servings' | 'makes' | 'batches';

export type ScaleStepper = {
	kind: ScaleStepperKind;
	// The value at the recipe's own scale: its servings, its count, or 1 batch.
	original: number;
	// Every value is a multiple of the step, from one step up to the recipe at its largest scale.
	step: number;
	min: number;
	max: number;
};

// The scale stops at 8 times the recipe.
const maxScaleFactor = 8;

// A recipe in batches, and what a recipe makes when its count halves whole, steps by half the recipe.
const halfRecipe = 1 / 2;

function stepperOf(kind: ScaleStepperKind, original: number, step: number): ScaleStepper {
	return { kind, original, step, min: step, max: original * maxScaleFactor };
}

// A count that is not whole would sit off its own steps, so it scales in batches.
export function scaleStepperFor(recipeYield: RecipeYield | undefined): ScaleStepper {
	if (
		recipeYield === undefined ||
		recipeYield.amount.max !== undefined ||
		!Number.isInteger(recipeYield.amount.min)
	) {
		return stepperOf('batches', 1, halfRecipe);
	}

	const count = recipeYield.amount.min;
	if (recipeYield.kind === 'servings') {
		return stepperOf('servings', count, 1);
	}

	return stepperOf('makes', count, count % 2 === 0 ? count * halfRecipe : count);
}

// The value the stepper holds for one typed or read from the URL: the nearest step, within bounds.
export function scaleStepperValue(stepper: ScaleStepper, value: number): number {
	const stepped = Math.round(value / stepper.step) * stepper.step;
	return Math.min(stepper.max, Math.max(stepper.min, stepped));
}

// The factor the recipe's amounts scale by at the stepper's value.
export function scaleFactor(stepper: ScaleStepper, value: number): number {
	return value / stepper.original;
}

// The stepper's label for each kind; a count of something named takes that name instead.
const stepperLabels = {
	servings: 'Servings',
	makes: 'Makes',
	batches: 'Batches',
} as const satisfies Record<ScaleStepperKind, string>;

// More than one of what a yield counts, which a label names: "Servings", "Loaves".
const several: Amount = { min: 2 };

// The stepper is labelled by what it counts, in the plural: "Servings", "Cookies" for "Makes 24
// cookies", or "Batches"; a count of nothing named, as in "Makes 24", by its verb, "Makes".
export function formatScaleStepperLabel(recipeYield: RecipeYield | undefined): string {
	const { kind } = scaleStepperFor(recipeYield);
	return kind === 'makes' && recipeYield?.kind === 'makes' && recipeYield.unit !== undefined
		? sentenceCase(itemForAmount(recipeYield.unit, recipeYield.amount, several))
		: stepperLabels[kind];
}

// How a yield's text opens, by its kind.
const yieldVerbs = {
	servings: 'Serves',
	makes: 'Makes',
} as const satisfies Record<RecipeYield['kind'], string>;

// One of what a yield counts, which a noun's number is judged from: "1 serving", "2 servings".
const one: Amount = { min: 1 };

// A count of what its singular names, in the number the count takes: "1 serving", "1½ batches".
function counted(amount: Amount, singular: string): string {
	return `${formatAmount(amount)} ${itemForAmount(singular, one, amount)}`;
}

// What a yield counts, after its verb: "6" servings, "24 cookies".
function yieldCount(recipeYield: RecipeYield): string {
	const amount = formatAmount(recipeYield.amount);
	return recipeYield.kind === 'makes' && recipeYield.unit !== undefined
		? `${amount} ${recipeYield.unit}`
		: amount;
}

// What a yield counts, named: "6 servings", "24 cookies". A count of nothing named has no name.
function namedYieldCount(recipeYield: RecipeYield): string | undefined {
	switch (recipeYield.kind) {
		case 'servings':
			return counted(recipeYield.amount, 'serving');
		case 'makes':
			return recipeYield.unit === undefined ? undefined : yieldCount(recipeYield);
	}
}

// The recipe in batches at a scale, counted as a yield is: "½ batch", "1½ batches".
function batchCount(factor: number): string {
	return counted(scaleCount(one, factor), 'batch');
}

export function formatYield(recipeYield: RecipeYield): string {
	return `${yieldVerbs[recipeYield.kind]} ${yieldCount(recipeYield)}`;
}

// The yield at a scale, as the recipe's header and the stepper's announcement give it: "Serves 12",
// "Makes 36 cookies", or "1½ batches" for a recipe that gives no yield.
export function formatScaledYield(recipeYield: RecipeYield | undefined, factor: number): string {
	return recipeYield === undefined
		? batchCount(factor)
		: formatYield(scaleYield(recipeYield, factor));
}

// The line print shows for a scaled recipe in place of the stepper: "Scaled to 8 servings (recipe
// serves 6)". A yield that names nothing it counts is scaled in batches: "Scaled to 1½ batches
// (recipe makes 24)".
export function formatScaledToLine(recipeYield: RecipeYield | undefined, factor: number): string {
	if (recipeYield === undefined) {
		return `Scaled to ${batchCount(factor)}`;
	}

	const scaled = namedYieldCount(scaleYield(recipeYield, factor)) ?? batchCount(factor);
	const verb = yieldVerbs[recipeYield.kind].toLowerCase();
	return `Scaled to ${scaled} (recipe ${verb} ${yieldCount(recipeYield)})`;
}

// The note under a scaled recipe's steps, which keep the recipe's own amounts: "Amounts in the steps
// are for the original 6 servings."
export function formatStepsNote(recipeYield: RecipeYield | undefined): string {
	const original = recipeYield === undefined ? undefined : namedYieldCount(recipeYield);
	return `Amounts in the steps are for the original ${original ?? 'batch'}.`;
}
