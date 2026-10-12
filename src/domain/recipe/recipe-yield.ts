import { z } from 'zod';
import { amountSchema } from '@/domain/recipe/amount';
import { formatAmount } from '@/domain/recipe/amount-format';
import { nonEmptyTextSchema } from '@/domain/text';

export const recipeYieldSchema = z.discriminatedUnion('kind', [
	z.object({ kind: z.literal('servings'), amount: amountSchema }),
	z.object({ kind: z.literal('makes'), amount: amountSchema, unit: nonEmptyTextSchema.optional() }),
]);
export type RecipeYield = z.infer<typeof recipeYieldSchema>;

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
