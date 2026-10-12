import { z } from 'zod';
import { amountSchema } from '@/domain/recipe/amount';
import { maxIngredientLineLength } from '@/domain/recipe/ingredient-limits';
import { nonEmptyTextSchema } from '@/domain/text';

export const ingredientLineSchema = z.object({
	// The line as originally written, kept verbatim apart from surrounding whitespace.
	text: nonEmptyTextSchema.max(
		maxIngredientLineLength,
		`Use ${maxIngredientLineLength} characters or fewer.`
	),
	amount: amountSchema.optional(),
	// Free text as written, such as cups or cloves.
	unit: nonEmptyTextSchema.optional(),
	item: nonEmptyTextSchema,
	preparation: nonEmptyTextSchema.optional(),
});
export type IngredientLine = z.infer<typeof ingredientLineSchema>;

export const ingredientSectionSchema = z.object({
	heading: nonEmptyTextSchema.optional(),
	lines: z.array(ingredientLineSchema).min(1, 'Add at least one ingredient.'),
});
export type IngredientSection = z.infer<typeof ingredientSectionSchema>;
