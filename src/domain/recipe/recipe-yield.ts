import { z } from 'zod';
import { amountSchema, type Amount } from '@/domain/recipe/amount';
import { formatAmount } from '@/domain/recipe/amount-format';
import type { ContentLimits } from '@/domain/recipe/content-limits';
import { parseAmountText, withoutClosingPunctuation } from '@/domain/recipe/ingredient-parser';
import { itemForAmount, scaleCount } from '@/domain/recipe/ingredient-scaling';
import { plainTextSchema } from '@/domain/text';
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

export function formatYield(recipeYield: RecipeYield): string {
	const amount = formatAmount(recipeYield.amount);

	switch (recipeYield.kind) {
		case 'servings':
			return `Serves ${amount}`;
		case 'makes':
			return recipeYield.unit === undefined
				? `Makes ${amount}`
				: `Makes ${amount} ${recipeYield.unit}`;
	}
}
