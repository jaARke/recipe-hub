import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { searchRecipes } from '@/app/_lib/search-recipes';
import type { RecipeSort } from '@/application/ports/recipe-repository';
import type { PublicRecipeDto, RecipeSummaryPage } from '@/application/recipes/recipe-dtos';
import type { RecipeSearchInput, RecipeSearchPage } from '@/application/search/recipe-search-dtos';
import { defaultListSort } from '@/components/recipe/recipe-list-params';
import { getRecipeService } from '@/composition/services';
import type { MemberId } from '@/domain/member/member';
import { settings } from '@/lib/settings';

// Each read is cached remotely (Vercel's Runtime Cache on a deployment), shared by every instance,
// so a reader reaching a fresh instance doesn't wait for the database to wake.

// The one home for recipe cache tags: Server Actions invalidate these names after a write.
export const recipeCacheTags = {
	list: 'recipes',
	// A recipe read by an old slug carries its current slug's tag too, so invalidating the current
	// slug clears it.
	recipe: (slug: string) => `recipe:${slug}`,
	// Every recipe page showing the member's name, so a rename reaches them all.
	member: (id: MemberId) => `member:${id}`,
	// Every list whose filters name members, one tag however many there are, so a rename reaches them.
	memberNames: 'member-names',
};

// A date filter's window moves with the clock, so its lists last an hour at most, even unread.
const dateFilteredListLife = { revalidate: 60 * 60, expire: 60 * 60 };

// Tagged with the slug asked for, so a miss clears once a recipe takes it, and with the current
// slug. Writes invalidate the tags; revalidating a day after caching catches edits made outside
// the app.
export async function getCachedRecipe(slug: string): Promise<PublicRecipeDto | null> {
	'use cache: remote';
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
	'use cache: remote';
	cacheTag(recipeCacheTags.list);
	cacheLife('days');
	return getRecipeService().listRecipes({
		limit: settings.display.recipesPerPage,
		offset: (page - 1) * settings.display.recipesPerPage,
		sort,
	});
}

// Browse's lists, read through search for the counts its filters show: each filter set, order, and
// page is its own entry. Null for input search refuses.
export async function getCachedRecipeSearchPage(
	input: RecipeSearchInput
): Promise<RecipeSearchPage | null> {
	'use cache: remote';
	cacheTag(recipeCacheTags.list, recipeCacheTags.memberNames);
	if (input.addedWithin === undefined) {
		cacheLife('days');
	} else {
		cacheLife(dateFilteredListLife);
	}
	return searchRecipes(input);
}

// The recipes a recipe's pages prerender for, its page and its cooking view: the list's first page.
export async function recipeStaticParams(): Promise<{ slug: string }[]> {
	const { recipes } = await getCachedRecipePage(1, defaultListSort);
	// A param is required but production starts empty; this one fails the slug schema and prerenders a 404.
	return recipes.length > 0 ? recipes.map(({ slug }) => ({ slug })) : [{ slug: '__placeholder__' }];
}
