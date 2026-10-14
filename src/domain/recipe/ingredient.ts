import { z } from 'zod';
import { amountSchema } from '@/domain/recipe/amount';
import type { ContentLimits } from '@/domain/recipe/content-limits';
import { headingTextSchema, nonEmptyTextSchema } from '@/domain/text';
import { settings } from '@/lib/settings';

export function ingredientLineSchemaFor(limits: ContentLimits) {
	return z.object({
		// The line as written, without a list's bullet or number or the punctuation that only ends it.
		text: limits.text(settings.recipeLimits.maxIngredientLineLength),
		amount: amountSchema.optional(),
		// Free text as written, such as cups or cloves.
		unit: nonEmptyTextSchema.optional(),
		item: nonEmptyTextSchema,
		preparation: nonEmptyTextSchema.optional(),
	});
}
export type IngredientLine = z.infer<ReturnType<typeof ingredientLineSchemaFor>>;

export function ingredientSectionSchemaFor(limits: ContentLimits) {
	return z.object({
		heading: limits
			.text(settings.recipeLimits.maxSectionHeadingLength, headingTextSchema)
			.optional(),
		lines: z.array(ingredientLineSchemaFor(limits)).min(1, 'Add at least one ingredient.'),
	});
}
export type IngredientSection = z.infer<ReturnType<typeof ingredientSectionSchemaFor>>;
