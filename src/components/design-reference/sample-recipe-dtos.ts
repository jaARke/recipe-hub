import {
	toPublicRecipeDto,
	toRecipeSummaryDto,
	type RecipeSummaryDto,
} from '@/application/recipes/recipe-dtos';
import { recipeSchema, type Recipe, type RecipeContentInput } from '@/domain/recipe/recipe';
import {
	sampleButtermilkBiscuits,
	sampleRecipeContents,
} from '@/domain/recipe/samples/sample-recipes';
import { slugify } from '@/domain/recipe/slug';

// The domain's synthetic samples, shaped by the same mappers as the pages. Never real user data.
// Apart from fixtures.ts, which client components import, because the mappers are server-only.

// Fixed so the reference renders the same every time, with an edit a day after the recipe was added.
const sampleCreatedAt = new Date('2026-10-11T14:00:00.000Z');
const sampleUpdatedAt = new Date('2026-10-12T16:30:00.000Z');

// The DTOs leave out the contributor, so any member id will do.
const sampleContributorId = '3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b';

function sampleRecipe(content: RecipeContentInput, index: number): Recipe {
	return recipeSchema.parse({
		...content,
		id: `0199c7a4-2c3e-7b1a-9f00-${String(index + 1).padStart(12, '0')}`,
		slug: slugify(content.title),
		contributorId: sampleContributorId,
		provenance: { entryMode: 'manual' },
		createdAt: sampleCreatedAt,
		updatedAt: sampleUpdatedAt,
	});
}

export const sampleRecipeSummaries: readonly RecipeSummaryDto[] = sampleRecipeContents.map(
	(content, index) => toRecipeSummaryDto(sampleRecipe(content, index))
);

// The biscuits lead the samples and fill in every part of the page but a source link.
export const sampleRecipeDetail = toPublicRecipeDto(sampleRecipe(sampleButtermilkBiscuits, 0));
