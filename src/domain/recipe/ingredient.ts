import { z } from 'zod';
import { amountSchema } from '@/domain/recipe/amount';
import type { ContentLimits } from '@/domain/recipe/content-limits';
import { plainTextSchema, sectionHeadingTextSchema } from '@/domain/text';
import { settings } from '@/lib/settings';

// What a recipe, or a section of its ingredients, with none is told.
export const noIngredientsMessage = 'Add at least one ingredient.';

export function ingredientLineSchemaFor(limits: ContentLimits) {
	return z.object({
		// The line as written, without a list's bullet or number or the punctuation that only ends it.
		text: limits.text(settings.recipeLimits.maxIngredientLineLength),
		amount: amountSchema.optional(),
		// Free text as written, such as cups or cloves.
		unit: plainTextSchema.optional(),
		item: plainTextSchema,
		preparation: plainTextSchema.optional(),
	});
}
export type IngredientLine = z.infer<ReturnType<typeof ingredientLineSchemaFor>>;

export function ingredientSectionSchemaFor(limits: ContentLimits) {
	return z.object({
		heading: limits
			.text(settings.recipeLimits.maxSectionHeadingLength, sectionHeadingTextSchema)
			.optional(),
		lines: z.array(ingredientLineSchemaFor(limits)).min(1, noIngredientsMessage),
	});
}
export type IngredientSection = z.infer<ReturnType<typeof ingredientSectionSchemaFor>>;
