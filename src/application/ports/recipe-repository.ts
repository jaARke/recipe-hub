import 'server-only';
import type { MemberId } from '@/domain/member/member';
import type { Provenance } from '@/domain/recipe/provenance';
import type { Recipe, RecipeContent, RecipeId } from '@/domain/recipe/recipe';
import type { RecipeImportId } from '@/domain/recipe/recipe-import';

export type NewRecipe = {
	content: RecipeContent;
	provenance: Provenance;
	// The import the recipe was saved from, if any.
	importId?: RecipeImportId;
	contributorId: MemberId;
	// The repository stores the first free slugCandidate built from this base.
	slugBase: string;
};

export type RecipeUpdate = {
	content: RecipeContent;
	// The updatedAt the edit started from; the update is refused when the recipe was saved since.
	expectedUpdatedAt: Date;
	// Given when the title's slug changes: the repository stores the first free slugCandidate built
	// from it, counting the recipe's own old slugs as free, and keeps the previous slug as an old one.
	slugBase?: string;
};

export type UpdatedRecipe = {
	recipe: Recipe;
	// The slug the recipe had when the update locked it, which differs when the slug moved.
	previousSlug: string;
};

// A recipe as read, and its content as saved. Reading tidies text, so the two differ where the recipe
// was saved before a tidying rule it now meets.
export type StoredRecipe = {
	recipe: Recipe;
	// Shaped as the recipe's content, since the recipe was read from it.
	storedContent: RecipeContent;
};

// Newest first, or A to Z by title with accents and case ignored.
export const recipeSorts = ['newest', 'title'] as const;
export type RecipeSort = (typeof recipeSorts)[number];

export type RecipePage = {
	limit: number;
	offset: number;
	sort: RecipeSort;
};

// A slug belongs to one recipe for as long as the recipe exists: as its current slug, or as an old one
// it was renamed from, so shared links keep finding it.
export interface RecipeRepository {
	findById(id: RecipeId): Promise<Recipe | null>;
	// The recipe and its content as saved, in one read, for a run that saves what reading now tidies.
	findStoredById(id: RecipeId): Promise<StoredRecipe | null>;
	// Also finds a recipe by an old slug; the recipe returned carries its current slug.
	findBySlug(slug: string): Promise<Recipe | null>;
	// In no particular order, each once, leaving out ids no recipe has.
	findByIds(ids: readonly RecipeId[]): Promise<Recipe[]>;
	// Every recipe's id and nothing else, newest first, for a run that reads the recipes one at a time.
	listIds(): Promise<RecipeId[]>;
	list(page: RecipePage): Promise<Recipe[]>;
	count(): Promise<number>;
	// Never takes a slug another recipe holds, current or old, even when creates and renames race.
	// Throws ImportUnavailableError when a recipe was already saved from the import.
	create(recipe: NewRecipe): Promise<Recipe>;
	// Replaces the content, and moves the slug when given a slug base, in one transaction. Each save
	// moves updatedAt forward by at least a millisecond, the precision a Date keeps, so it versions
	// the recipe. Throws RecipeEditConflictError when updatedAt is no longer the expected one, and
	// returns null when no recipe has this id.
	update(id: RecipeId, update: RecipeUpdate): Promise<UpdatedRecipe | null>;
	// Returns the recipe as it was when deleted, or null when no recipe has this id. Its old slugs are
	// freed with it.
	delete(id: RecipeId): Promise<Recipe | null>;
	// The given image pathnames that some recipe still lists, ignoring the excluded contributor's
	// recipes.
	findImagesInUse(pathnames: readonly string[], excludeContributorId?: MemberId): Promise<string[]>;
}
