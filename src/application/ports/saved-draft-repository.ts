import 'server-only';
import type { SavedDraftId } from '@/application/drafts/saved-draft';
import type { MemberId } from '@/domain/member/member';
import type { Provenance } from '@/domain/recipe/provenance';
import type { ImportDraft, RecipeImportId } from '@/domain/recipe/recipe-import';

// What a save writes: the form's values, with what the list of drafts and the image sweep read from
// them.
export type SavedDraftContents = {
	// Absent while the recipe has no title.
	title?: string;
	values: unknown;
	// The images the values name, which the image sweep keeps while the draft lasts.
	imagePathnames: readonly string[];
};

export type SavedDraftUpdate = SavedDraftContents & {
	// The updatedAt the save started from; the update is refused when the draft was saved since.
	expectedUpdatedAt: Date;
};

export type NewSavedDraft = SavedDraftContents & {
	memberId: MemberId;
};

// The draft an import makes as it succeeds, for its member: what it read, in place of the form's
// values until the form first saves it, and the provenance the recipe takes.
export type NewImportedDraft = {
	provenance: Provenance;
	// The title the import found, if any.
	title?: string;
	imported: ImportDraft;
	// The images what it read names, which the image sweep keeps while the draft lasts.
	imagePathnames: readonly string[];
};

export type SavedDraft = {
	id: SavedDraftId;
	memberId: MemberId;
	// The import that made it.
	importId?: RecipeImportId;
	// The provenance of the import that made it; absent for a draft entered by hand.
	provenance?: Provenance;
	title?: string;
	// The form's values as last saved; absent from an import's draft until the form first saves it.
	values?: unknown;
	// What the import read, until the form first saves the draft's values.
	imported?: ImportDraft;
	imagePathnames: string[];
	createdAt: Date;
	// When it was last changed.
	updatedAt: Date;
};

// A draft as the member's list of drafts shows it, without its values.
export type SavedDraftSummary = Pick<SavedDraft, 'id' | 'provenance' | 'title' | 'updatedAt'>;

// The members' drafts: those they save from the recipe form, and those their imports make
// (RecipeImportRepository.recordSuccess). Each is kept until it is deleted; readers pass the time
// before which a draft has expired, and ignore those last changed before it. Removing a member
// deletes theirs (MemberRepository.remove).
export interface SavedDraftRepository {
	create(draft: NewSavedDraft): Promise<SavedDraft>;
	// Replaces the contents, keeping the import and provenance and letting go of what the import read,
	// and marks the draft saved now. Each save moves updatedAt forward by at least a millisecond, the
	// precision a Date keeps, so it versions the draft. Throws SavedDraftEditConflictError when
	// updatedAt is no longer the expected one, and returns null when no draft has this id.
	update(id: SavedDraftId, update: SavedDraftUpdate): Promise<SavedDraft | null>;
	findById(id: SavedDraftId): Promise<SavedDraft | null>;
	// The draft the import made, if it still exists.
	findByImportId(importId: RecipeImportId): Promise<SavedDraft | null>;
	// The member's drafts changed since the given time, newest first.
	list(memberId: MemberId, since: Date): Promise<SavedDraftSummary[]>;
	// How many drafts the member changed since the given time.
	count(memberId: MemberId, since: Date): Promise<number>;
	// The given image pathnames that a draft changed since the given time names, ignoring the excluded
	// member's drafts.
	findImagesInUse(
		pathnames: readonly string[],
		since: Date,
		excludeMemberId?: MemberId
	): Promise<string[]>;
	// Returns the deleted draft, or null when no draft has this id.
	delete(id: SavedDraftId): Promise<SavedDraft | null>;
	// Deletes every draft last changed before the given time, and returns how many it deleted.
	deleteSavedBefore(cutoff: Date): Promise<number>;
}
