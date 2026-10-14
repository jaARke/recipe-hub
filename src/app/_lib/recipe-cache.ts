import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import type { RecipeSort } from '@/application/ports/recipe-repository';
import type { PublicRecipeDto, RecipeSummaryPage } from '@/application/recipes/recipe-dtos';
import { getRecipeService } from '@/composition/services';
import type { MemberId } from '@/domain/member/member';

// The one home for recipe cache tags: Server Actions invalidate these names after a write.
export const recipeCacheTags = {
	list: 'recipes',
	// A recipe read by an old slug carries its current slug's tag too, so invalidating the current
	// slug clears it.
	recipe: (slug: string) => `recipe:${slug}`,
	// Every recipe page showing the member's name, so a rename reaches them all.
	member: (id: MemberId) => `member:${id}`,
};

export const recipesPerPage = 24;

// Tagged with the slug asked for, so a miss clears once a recipe takes it, and with the current
// slug. Writes invalidate the tags; revalidating a day after caching catches edits made outside
// the app.
export async function getCachedRecipe(slug: string): Promise<PublicRecipeDto | null> {
	'use cache';
	cacheTag(recipeCacheTags.recipe(slug));
	cacheLife('days');
	const recipe = await getRecipeService().getRecipe(slug);
	if (recipe !== null) {
		cacheTag(recipeCacheTags.recipe(recipe.slug), recipeCacheTags.member(recipe.contributor.id));
	}
	return recipe;
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

// Every tag label in use, which the recipe form suggests and filters in the browser.
export async function getCachedTagLabels(): Promise<string[]> {
	'use cache';
	cacheTag(recipeCacheTags.list);
	cacheLife('days');
	return getRecipeService().listTagLabels();
}
