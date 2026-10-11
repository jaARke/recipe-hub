import { z } from 'zod';
import { ingredientLineSchema, ingredientSectionSchema } from '@/domain/recipe/ingredient';
import { instructionSectionSchema, instructionStepSchema } from '@/domain/recipe/instruction';
import { provenanceSchema } from '@/domain/recipe/provenance';
import { recipeContentSchema } from '@/domain/recipe/recipe';
import { recipeProblemSchema } from '@/domain/recipe/recipe-problem';

const draftIngredientSectionSchema = ingredientSectionSchema.extend({
	lines: z.array(ingredientLineSchema.partial({ item: true })),
});

const draftInstructionSectionSchema = instructionSectionSchema.extend({
	steps: z.array(instructionStepSchema),
});

// Content as an entry mode produced it: anything may be missing, but what is present is valid.
export const recipeDraftContentSchema = recipeContentSchema.partial().extend({
	ingredientSections: z.array(draftIngredientSectionSchema).optional(),
	instructionSections: z.array(draftInstructionSectionSchema).optional(),
});
export type RecipeDraftContent = z.infer<typeof recipeDraftContentSchema>;

// Never saved: a member reviews the draft in the recipe form, which saves it as a recipe.
export const recipeDraftSchema = z.object({
	content: recipeDraftContentSchema,
	provenance: provenanceSchema,
	problems: z.array(recipeProblemSchema),
});
export type RecipeDraft = z.infer<typeof recipeDraftSchema>;
