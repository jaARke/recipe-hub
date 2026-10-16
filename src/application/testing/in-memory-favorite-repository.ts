import type { FavoritePage, FavoriteRepository } from '@/application/ports/favorite-repository';
import type { InMemoryRecipeRepository } from '@/application/testing/in-memory-recipe-repository';
import type { MemberId } from '@/domain/member/member';
import type { Recipe, RecipeId } from '@/domain/recipe/recipe';

type StoredFavorite = {
	memberId: MemberId;
	recipeId: RecipeId;
	createdAt: Date;
};

function favoriteKey(memberId: MemberId, recipeId: RecipeId): string {
	return `${memberId}:${recipeId}`;
}

// A deleted recipe leaves its favorites here, so reads skip them, as the database's cascade deletes
// them.
export class InMemoryFavoriteRepository implements FavoriteRepository {
	// Insertion order is the order favorites were added.
	private readonly favorites = new Map<string, StoredFavorite>();
	private readonly recipes: InMemoryRecipeRepository;

	// The recipes favorites name, as the database joins them.
	constructor(recipes: InMemoryRecipeRepository) {
		this.recipes = recipes;
	}

	// Adds the last first, so the first is the newest. After the one lookup it does not await, so
	// concurrent adds take turns as the database's do.
	async add(memberId: MemberId, recipeIds: readonly RecipeId[]): Promise<number> {
		const found = new Set((await this.recipes.findByIds(recipeIds)).map(({ id }) => id));
		const createdAt = new Date();
		let added = 0;
		for (const recipeId of [...new Set(recipeIds)].reverse()) {
			const key = favoriteKey(memberId, recipeId);
			if (found.has(recipeId) && !this.favorites.has(key)) {
				this.favorites.set(key, { memberId, recipeId, createdAt });
				added += 1;
			}
		}
		return added;
	}

	async remove(memberId: MemberId, recipeId: RecipeId): Promise<void> {
		this.favorites.delete(favoriteKey(memberId, recipeId));
	}

	async has(memberId: MemberId, recipeId: RecipeId): Promise<boolean> {
		return (await this.listAll(memberId)).some(({ id }) => id === recipeId);
	}

	async list(memberId: MemberId, page: FavoritePage): Promise<Recipe[]> {
		return (await this.listAll(memberId)).slice(page.offset, page.offset + page.limit);
	}

	async count(memberId: MemberId): Promise<number> {
		return (await this.listAll(memberId)).length;
	}

	// Stands in for the delete a member's removal makes in its transaction. It does not await, so the
	// removal stays one uninterrupted step.
	removeAllOf(memberId: MemberId): void {
		for (const [key, favorite] of this.favorites) {
			if (favorite.memberId === memberId) {
				this.favorites.delete(key);
			}
		}
	}

	// The member's favorite recipes that still exist, newest first.
	private async listAll(memberId: MemberId): Promise<Recipe[]> {
		// Reversed first, so the stable sort lists favorites added in the same millisecond newest first.
		const stored = [...this.favorites.values()]
			.filter((favorite) => favorite.memberId === memberId)
			.reverse()
			.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
		const found = await this.recipes.findByIds(stored.map(({ recipeId }) => recipeId));
		const recipesById = new Map(found.map((recipe) => [recipe.id, recipe]));
		return stored.flatMap(({ recipeId }) => recipesById.get(recipeId) ?? []);
	}
}
