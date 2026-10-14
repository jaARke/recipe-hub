import { z } from 'zod';
import { problemSchema } from '@/domain/problem';
import { storedContent } from '@/domain/recipe/content-limits';
import { ingredientLineSchemaFor, ingredientSectionSchemaFor } from '@/domain/recipe/ingredient';
import { instructionSectionSchemaFor, instructionStepSchemaFor } from '@/domain/recipe/instruction';
import { provenanceSchema } from '@/domain/recipe/provenance';
import { storedRecipeContentSchema } from '@/domain/recipe/recipe';

const draftIngredientSectionSchema = ingredientSectionSchemaFor(storedContent).extend({
	lines: z.array(ingredientLineSchemaFor(storedContent).partial({ item: true })),
});

const draftInstructionSectionSchema = instructionSectionSchemaFor(storedContent).extend({
	steps: z.array(instructionStepSchemaFor(storedContent)),
});

// Content as an entry mode produced it: anything may be missing, but what is present is valid. A
// draft is read whatever the limits are now: an import fits each text to its limit, and saving checks
// them all.
export const recipeDraftContentSchema = storedRecipeContentSchema.partial().extend({
	ingredientSections: z.array(draftIngredientSectionSchema).optional(),
	instructionSections: z.array(draftInstructionSectionSchema).optional(),
});
export type RecipeDraftContent = z.infer<typeof recipeDraftContentSchema>;

// Never saved: a member reviews the draft in the recipe form, which saves it as a recipe.
export const recipeDraftSchema = z.object({
	content: recipeDraftContentSchema,
	provenance: provenanceSchema,
	problems: z.array(problemSchema),
});
export type RecipeDraft = z.infer<typeof recipeDraftSchema>;
