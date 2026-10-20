import 'server-only';
import type { SavedDraftId } from '@/application/drafts/saved-draft';

// Returned by an import, so the caller can open the draft it made.
export type RecipeImportRef = {
	draftId: SavedDraftId;
};
