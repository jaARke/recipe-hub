import 'server-only';
import type { RecipeId } from '@/domain/recipe/recipe';

// A signed-out reader's favorites, kept on their device rather than in an account. Only a Server
// Action or a Route Handler can save or clear them, since the response carries the change.
export interface DeviceFavorites {
	// Newest first, at most settings.favorites.maxPerDevice. What the device holds is never trusted: a
	// tampered or malformed list reads as the ids that survive validation, or as none.
	list(): Promise<RecipeId[]>;
	// Replaces the list, newest first, and renews how long the device keeps it. Throws when given more
	// than settings.favorites.maxPerDevice ids.
	save(recipeIds: readonly RecipeId[]): Promise<void>;
	clear(): Promise<void>;
}
