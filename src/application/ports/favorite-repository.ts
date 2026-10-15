import 'server-only';
import type { MemberId } from '@/domain/member/member';
import type { Recipe, RecipeId } from '@/domain/recipe/recipe';

export type FavoritePage = {
	limit: number;
	offset: number;
};

// A member's favorite recipes. Deleting a recipe takes it out of every member's favorites, and
// removing a member deletes theirs (MemberRepository.remove).
export interface FavoriteRepository {
	// Adds the recipes, the first as the newest, skipping those already favorites and ids no recipe
	// has. Returns how many it added.
	add(memberId: MemberId, recipeIds: readonly RecipeId[]): Promise<number>;
	// Removing a recipe that is not a favorite changes nothing.
	remove(memberId: MemberId, recipeId: RecipeId): Promise<void>;
	has(memberId: MemberId, recipeId: RecipeId): Promise<boolean>;
	// Newest favorite first.
	list(memberId: MemberId, page: FavoritePage): Promise<Recipe[]>;
	count(memberId: MemberId): Promise<number>;
}
