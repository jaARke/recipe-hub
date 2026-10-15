import 'server-only';
import type { SavedDraftId } from '@/application/drafts/saved-draft';
import type { RecipeImportId, RecipeImportMode } from '@/domain/recipe/recipe-import';

// A draft the member saved, to open in the recipe form, which checks its values as it reads them.
export type SavedDraftDto = {
	id: SavedDraftId;
	// The import whose review the draft continues, while that review can still be saved.
	continuesImportId?: RecipeImportId;
	values: unknown;
	savedAt: Date;
	expiresAt: Date;
};

// Returned by a save, so the form can name the draft and say when it was saved.
export type SavedDraftRef = {
	id: SavedDraftId;
	savedAt: Date;
};

// One entry in the member's Drafts: a draft they saved, or an import's draft awaiting review, each
// with when it is deleted unless saved again or saved as a recipe.
export type DraftSummaryDto =
	| {
			kind: 'saved';
			id: SavedDraftId;
			continuesImportId?: RecipeImportId;
			title?: string;
			savedAt: Date;
			expiresAt: Date;
	  }
	| {
			kind: 'import';
			id: RecipeImportId;
			mode: RecipeImportMode;
			title?: string;
			importedAt: Date;
			expiresAt: Date;
	  };
