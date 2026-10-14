import { z } from 'zod';
import { amountSchema } from '@/domain/recipe/amount';
import { formatAmount } from '@/domain/recipe/amount-format';
import type { ContentLimits } from '@/domain/recipe/content-limits';
import { itemForAmount, scaleCount } from '@/domain/recipe/ingredient-scaling';
import { settings } from '@/lib/settings';

export function recipeYieldSchemaFor(limits: ContentLimits) {
	return z.discriminatedUnion('kind', [
		z.object({ kind: z.literal('servings'), amount: amountSchema }),
		z.object({
			kind: z.literal('makes'),
			amount: amountSchema,
			unit: limits.text(settings.recipeLimits.maxYieldUnitLength).optional(),
		}),
	]);
}
export type RecipeYield = z.infer<ReturnType<typeof recipeYieldSchemaFor>>;

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
