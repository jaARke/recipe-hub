import { z } from 'zod';
import { amountSchema } from '@/domain/recipe/amount';
import { formatAmount } from '@/domain/recipe/amount-format';
import type { ContentLimits } from '@/domain/recipe/content-limits';
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
