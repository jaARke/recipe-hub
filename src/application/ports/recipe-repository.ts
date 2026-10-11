import 'server-only';
import type { MemberId } from '@/domain/member/member';
import type { Provenance } from '@/domain/recipe/provenance';
import type { Recipe, RecipeContent, RecipeId } from '@/domain/recipe/recipe';

export type NewRecipe = {
	content: RecipeContent;
	provenance: Provenance;
	contributorId: MemberId;
	// The repository stores the first free slugCandidate built from this base.
	slugBase: string;
};

export type RecipePage = {
	limit: number;
	offset: number;
};

export interface RecipeRepository {
	findById(id: RecipeId): Promise<Recipe | null>;
	findBySlug(slug: string): Promise<Recipe | null>;
	// Newest first.
	list(page: RecipePage): Promise<Recipe[]>;
	create(recipe: NewRecipe): Promise<Recipe>;
	// Replaces the content and returns null when no recipe has this id.
	update(id: RecipeId, content: RecipeContent): Promise<Recipe | null>;
	// Returns false when no recipe has this id.
	delete(id: RecipeId): Promise<boolean>;
	// Tag labels in use whose tagKey is one of the given keys, ignoring the excluded recipe's own tags.
	findTagLabels(keys: readonly string[], excludeRecipeId?: RecipeId): Promise<string[]>;
}
