import { toPublicRecipeDto, type PublicRecipeDto } from '@/application/recipes/recipe-dtos';
import { memberSchema } from '@/domain/member/member';
import { recipeSchema, type RecipeContentInput } from '@/domain/recipe/recipe';

// Adds every recipe below.
const contributor = memberSchema.parse({
	id: '0199c7a4-2c3e-7b1a-9f00-3b8d2f5c6e7f',
	displayName: 'Ada',
	email: 'ada@example.com',
	role: 'member',
	createdAt: new Date('2026-09-01T12:00:00.000Z'),
});

// A recipe entered by hand, as its page gets it from the page's own mapper: added on 1 October 2026
// and edited four days later.
export function publicRecipe(slug: string, content: RecipeContentInput): PublicRecipeDto {
	const recipe = recipeSchema.parse({
		...content,
		id: '0199c7a4-2c3e-7b1a-9f00-2a7c1e4b5d6e',
		slug,
		contributorId: contributor.id,
		provenance: { entryMode: 'manual' },
		createdAt: new Date('2026-10-01T12:00:00.000Z'),
		updatedAt: new Date('2026-10-05T08:30:00.000Z'),
	});
	return toPublicRecipeDto(recipe, contributor);
}
