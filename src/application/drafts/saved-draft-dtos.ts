import 'server-only';
import type { SavedDraftId } from '@/application/drafts/saved-draft';
import type { ImportDraft, RecipeImportMode } from '@/domain/recipe/recipe-import';

// A member's draft, to open in the recipe form, which checks its values as it reads them.
export type SavedDraftDto = {
	id: SavedDraftId;
	// How the import that made the draft read the recipe; absent for a draft entered by hand.
	mode?: RecipeImportMode;
	// For a URL import, the page the recipe was read from.
	sourceUrl?: string;
	// The form's values as last saved; absent from an import's draft until the form first saves it.
	values?: unknown;
	// What the import read, until the form first saves the draft's values.
	imported?: ImportDraft;
	savedAt: Date;
	expiresAt: Date;
};

// Returned by a save, so the form can name the draft and say when it was saved, which is its version.
export type SavedDraftRef = {
	id: SavedDraftId;
	savedAt: Date;
};

// One entry in the member's list of drafts, with when it is deleted unless changed again or saved as
// a recipe.
export type DraftSummaryDto = {
	id: SavedDraftId;
	// As the draft's SavedDraftDto has it.
	mode?: RecipeImportMode;
	title?: string;
	savedAt: Date;
	expiresAt: Date;
};
