import 'server-only';
import type { MemberId } from '@/domain/member/member';
import type {
	ImportDraft,
	RecipeImport,
	RecipeImportId,
	RecipeImportMode,
} from '@/domain/recipe/recipe-import';

export type NewRecipeImport = {
	memberId: MemberId;
	mode: RecipeImportMode;
};

// A rolling window: at most maxImports started by the member since the given time.
export type RecipeImportLimit = {
	maxImports: number;
	since: Date;
};

export type ImportSuccess = {
	draft: ImportDraft;
	// For a URL import, the address the page was read from.
	sourceUrl?: string;
	// The model that answered, when one read the recipe.
	aiModel?: string;
	costUsd?: number;
};

export type ImportFailure = {
	// The code of the error that ended the import.
	failure: string;
	costUsd?: number;
};

// A draft awaiting review, as a member's list of unsaved imports shows it.
export type UnsavedImport = {
	id: RecipeImportId;
	mode: RecipeImportMode;
	// The draft's title, when the import found one.
	title?: string;
	createdAt: Date;
};

// Every import is kept as a record of use and cost. Its draft and source URL are cleared once a
// recipe is saved from it or the draft expires.
export interface RecipeImportRepository {
	// Stores a running import. Given a limit, it counts the member's imports and stores the new one under
	// a lock per member, so concurrent starts never exceed it, and returns null once it is reached.
	start(recipeImport: NewRecipeImport, limit?: RecipeImportLimit): Promise<RecipeImport | null>;
	// Returns false when no running import has this id.
	recordSuccess(id: RecipeImportId, success: ImportSuccess): Promise<boolean>;
	// Returns false when no running import has this id.
	recordFailure(id: RecipeImportId, failure: ImportFailure): Promise<boolean>;
	// The import carries the slug of the recipe saved from it, if any.
	findById(id: RecipeImportId): Promise<RecipeImport | null>;
	// The member's succeeded imports since the given time that still hold a draft and saved no recipe,
	// newest first, at most limit of them.
	listUnsaved(memberId: MemberId, since: Date, limit: number): Promise<UnsavedImport[]>;
	// The given image pathnames that a draft awaiting review names: the draft of any member's succeeded
	// import since the given time that saved no recipe, ignoring the excluded member's imports.
	findImagesInUnsavedImports(
		pathnames: readonly string[],
		since: Date,
		excludeMemberId?: MemberId
	): Promise<string[]>;
	clearDraft(id: RecipeImportId): Promise<void>;
	// Clears the draft and source URL of every import started before the given time, and returns how
	// many imports it cleared.
	clearDraftsCreatedBefore(cutoff: Date): Promise<number>;
}
