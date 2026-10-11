import { z } from 'zod';
import { memberIdSchema } from '@/domain/member/member';
import { recipeTimesSchema } from '@/domain/recipe/duration';
import { InvalidRecipeError } from '@/domain/recipe/errors';
import { ingredientSectionSchema } from '@/domain/recipe/ingredient';
import { instructionSectionSchema } from '@/domain/recipe/instruction';
import { provenanceSchema } from '@/domain/recipe/provenance';
import { recipeImageListSchema } from '@/domain/recipe/recipe-image';
import { recipeProblemsFromZodError } from '@/domain/recipe/recipe-problem';
import { recipeYieldSchema } from '@/domain/recipe/recipe-yield';
import { slugSchema } from '@/domain/recipe/slug';
import { tagListSchema } from '@/domain/recipe/tag';
import { nonEmptyTextSchema } from '@/domain/recipe/text';

export const recipeIdSchema = z.uuid().brand<'RecipeId'>();
export type RecipeId = z.infer<typeof recipeIdSchema>;

// Stored as one document and parsed on every read: add fields as optional, and unknown fields drop.
export const recipeContentSchema = z.object({
	title: nonEmptyTextSchema,
	description: nonEmptyTextSchema.optional(),
	// The story behind the recipe.
	notes: nonEmptyTextSchema.optional(),
	// Who or where the recipe comes from, such as a relative or a cookbook; not the contributor.
	source: nonEmptyTextSchema.optional(),
	yield: recipeYieldSchema.optional(),
	times: recipeTimesSchema,
	ingredientSections: z.array(ingredientSectionSchema).min(1, 'Add at least one ingredient.'),
	instructionSections: z.array(instructionSectionSchema).min(1, 'Add at least one step.'),
	tags: tagListSchema,
	images: recipeImageListSchema,
});
export type RecipeContent = z.infer<typeof recipeContentSchema>;
export type RecipeContentInput = z.input<typeof recipeContentSchema>;

export const recipeSchema = recipeContentSchema.extend({
	id: recipeIdSchema,
	// Assigned once at creation and kept when the title changes, so shared links keep working.
	slug: slugSchema,
	contributorId: memberIdSchema,
	provenance: provenanceSchema,
	createdAt: z.date(),
	updatedAt: z.date(),
});
export type Recipe = z.infer<typeof recipeSchema>;

export function parseRecipeContent(input: unknown): RecipeContent {
	const result = recipeContentSchema.safeParse(input);
	if (!result.success) {
		throw new InvalidRecipeError(recipeProblemsFromZodError(result.error));
	}
	return result.data;
}
