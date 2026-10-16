import type { DeviceFavorites } from '@/application/ports/device-favorites';
import type { RecipeId } from '@/domain/recipe/recipe';
import { settings } from '@/lib/settings';

// One device's favorites, kept as saved.
export class InMemoryDeviceFavorites implements DeviceFavorites {
	private recipeIds: RecipeId[] = [];

	async list(): Promise<RecipeId[]> {
		return [...this.recipeIds];
	}

	async save(recipeIds: readonly RecipeId[]): Promise<void> {
		if (recipeIds.length > settings.favorites.maxPerDevice) {
			throw new Error('A device keeps at most settings.favorites.maxPerDevice favorites');
		}

		this.recipeIds = [...recipeIds];
	}

	async clear(): Promise<void> {
		this.recipeIds = [];
	}
}
