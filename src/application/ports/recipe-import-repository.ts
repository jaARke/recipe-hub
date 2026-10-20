import 'server-only';
import type { SavedDraftId } from '@/application/drafts/saved-draft';
import type { NewImportedDraft } from '@/application/ports/saved-draft-repository';
import type { MemberId } from '@/domain/member/member';
import type { RecipeImport, RecipeImportId, RecipeImportMode } from '@/domain/recipe/recipe-import';

export type NewRecipeImport = {
	memberId: MemberId;
	mode: RecipeImportMode;
};

// A rolling window: at most maxImports started by the member since the given time.
export type RecipeImportLimit = {
	maxImports: number;
	since: Date;
	// The failure codes of imports the window leaves out; none when absent.
	uncountedFailures?: readonly string[];
};

export type ImportSuccess = {
	// The model that answered, when one read the recipe.
	aiModel?: string;
	costUsd?: number;
	// The draft the member goes on with, which the import makes as it succeeds.
	draft: NewImportedDraft;
};

export type ImportFailure = {
	// The code of the error that ended the import.
	failure: string;
	costUsd?: number;
};

// Every import is kept as a record of use and cost. What it read lives on the draft it made
// (SavedDraftRepository).
export interface RecipeImportRepository {
	// Stores a running import. Given a limit, it counts the member's imports but those the limit leaves
	// out, and stores the new one under a lock per member, so concurrent starts never exceed it, and
	// returns null once it is reached. A running import always counts, so its failing can only lower the
	// count.
	start(recipeImport: NewRecipeImport, limit?: RecipeImportLimit): Promise<RecipeImport | null>;
	// Records the success and creates the import's draft for its member in one transaction, so neither
	// is kept without the other, and returns the draft's id. Returns null, changing nothing, when no
	// running import has this id, and throws, changing nothing, when the import already has a draft.
	recordSuccess(id: RecipeImportId, success: ImportSuccess): Promise<SavedDraftId | null>;
	// Returns false when no running import has this id.
	recordFailure(id: RecipeImportId, failure: ImportFailure): Promise<boolean>;
	// The import carries the slug of the recipe saved from it, if any.
	findById(id: RecipeImportId): Promise<RecipeImport | null>;
	// Records every import still running that started before the given time as failed with the given
	// code, and returns how many it recorded.
	failRunningCreatedBefore(cutoff: Date, failure: string): Promise<number>;
}
