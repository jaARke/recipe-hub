import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import type { RecipeSort } from '@/application/ports/recipe-repository';
import type { PublicRecipeDto, RecipeSummaryPage } from '@/application/recipes/recipe-dtos';
import { getRecipeService } from '@/composition/services';

// The one home for recipe cache tags: Server Actions invalidate these names after a write.
export const recipeCacheTags = {
	list: 'recipes',
	recipe: (slug: string) => `recipe:${slug}`,
};

export const recipesPerPage = 24;

// Writes invalidate the tags; revalidating a day after caching catches edits made outside the app.
export async function getCachedRecipe(slug: string): Promise<PublicRecipeDto | null> {
	'use cache';
	cacheTag(recipeCacheTags.recipe(slug));
	cacheLife('days');
	return getRecipeService().getRecipe(slug);
}

// Pages count from 1; each page in each order is its own entry.
export async function getCachedRecipePage(
	page: number,
	sort: RecipeSort
): Promise<RecipeSummaryPage> {
	'use cache';
	cacheTag(recipeCacheTags.list);
	cacheLife('days');
	return getRecipeService().listRecipes({
		limit: recipesPerPage,
		offset: (page - 1) * recipesPerPage,
		sort,
	});
}
