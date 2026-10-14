import { z } from 'zod';
import { memberIdSchema } from '@/domain/member/member';
import { problemsFromZodError } from '@/domain/problem';
import { storedContent, writtenContent, type ContentLimits } from '@/domain/recipe/content-limits';
import { recipeTimesSchema } from '@/domain/recipe/duration';
import { InvalidRecipeError } from '@/domain/recipe/errors';
import { ingredientSectionSchemaFor } from '@/domain/recipe/ingredient';
import { instructionSectionSchemaFor } from '@/domain/recipe/instruction';
import { provenanceSchema } from '@/domain/recipe/provenance';
import { recipeImageListSchemaFor } from '@/domain/recipe/recipe-image';
import { recipeYieldSchemaFor } from '@/domain/recipe/recipe-yield';
import { slugSchema } from '@/domain/recipe/slug';
import { tagListSchemaFor } from '@/domain/recipe/tag';
import { headingTextSchema, limitMessage } from '@/domain/text';
import { settings } from '@/lib/settings';

export const recipeIdSchema = z.uuid().brand<'RecipeId'>();
export type RecipeId = z.infer<typeof recipeIdSchema>;

// A list's sections and what limits them: at least one section, the most sections a list holds, and
// the most items across them.
type SectionListRules<Section extends z.ZodType> = {
	emptyMessage: string;
	itemCount(section: z.output<Section>): number;
	maxItems: number;
	// What the items are called, such as "steps".
	itemUnits: string;
};

function sectionListSchema<Section extends z.ZodType>(
	section: Section,
	limits: ContentLimits,
	rules: SectionListRules<Section>
) {
	return z
		.array(section)
		.min(1, rules.emptyMessage)
		.refine(
			(sections) => !limits.exceeds(sections.length, settings.recipeLimits.maxSectionsPerList),
			limitMessage(settings.recipeLimits.maxSectionsPerList, 'sections')
		)
		.refine(
			(sections) =>
				!limits.exceeds(
					sections.reduce((count, each) => count + rules.itemCount(each), 0),
					rules.maxItems
				),
			limitMessage(rules.maxItems, rules.itemUnits)
		);
}

// Stored as one document: add fields as optional, and unknown fields drop.
function recipeContentSchemaFor(limits: ContentLimits) {
	return z.object({
		title: limits.text(settings.recipeLimits.maxTitleLength, headingTextSchema),
		description: limits.text(settings.recipeLimits.maxDescriptionLength).optional(),
		// The story behind the recipe.
		notes: limits.text(settings.recipeLimits.maxNotesLength).optional(),
		// Who or where the recipe comes from, such as a relative or a cookbook; not the contributor.
		source: limits.text(settings.recipeLimits.maxSourceLength).optional(),
		yield: recipeYieldSchemaFor(limits).optional(),
		times: recipeTimesSchema,
		ingredientSections: sectionListSchema(ingredientSectionSchemaFor(limits), limits, {
			emptyMessage: 'Add at least one ingredient.',
			itemCount: (section) => section.lines.length,
			maxItems: settings.recipeLimits.maxIngredientLinesPerRecipe,
			itemUnits: 'ingredients',
		}),
		instructionSections: sectionListSchema(instructionSectionSchemaFor(limits), limits, {
			emptyMessage: 'Add at least one step.',
			itemCount: (section) => section.steps.length,
			maxItems: settings.recipeLimits.maxStepsPerRecipe,
			itemUnits: 'steps',
		}),
		tags: tagListSchemaFor(limits),
		images: recipeImageListSchemaFor(limits),
	});
}

// Content being saved, within the recipe limits.
export const recipeContentSchema = recipeContentSchemaFor(writtenContent);
export type RecipeContent = z.infer<typeof recipeContentSchema>;
export type RecipeContentInput = z.input<typeof recipeContentSchema>;

// Content as stored, which every read parses whatever the limits are now.
export const storedRecipeContentSchema = recipeContentSchemaFor(storedContent);

export const recipeSchema = storedRecipeContentSchema.extend({
	id: recipeIdSchema,
	// Follows the title; old slugs keep finding the recipe, so shared links keep working.
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
		throw new InvalidRecipeError(problemsFromZodError(result.error));
	}
	return result.data;
}
