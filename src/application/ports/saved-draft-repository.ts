import 'server-only';
import type { SavedDraftId } from '@/application/drafts/saved-draft';
import type { MemberId } from '@/domain/member/member';
import type { Provenance } from '@/domain/recipe/provenance';
import type { RecipeImportId } from '@/domain/recipe/recipe-import';

// What a save writes: the form's values, with what the list of drafts and the image sweep read from
// them.
export type SavedDraftContents = {
	// Absent while the recipe has no title.
	title?: string;
	values: unknown;
	// The images the values name, which the image sweep keeps while the draft lasts.
	imagePathnames: readonly string[];
};

export type NewSavedDraft = SavedDraftContents & {
	memberId: MemberId;
	// The import whose review the draft continues.
	importId?: RecipeImportId;
	// That import's provenance, which the draft keeps after the import's own source URL is cleared.
	provenance?: Provenance;
};

export type SavedDraft = {
	id: SavedDraftId;
	memberId: MemberId;
	importId?: RecipeImportId;
	provenance?: Provenance;
	title?: string;
	values: unknown;
	imagePathnames: string[];
	createdAt: Date;
	// When it was last saved.
	updatedAt: Date;
};

// A draft as the member's list of drafts shows it, without its values.
export type SavedDraftSummary = Pick<
	SavedDraft,
	'id' | 'importId' | 'provenance' | 'title' | 'updatedAt'
>;

// The drafts members save from the recipe form. Each is kept until it is deleted; readers pass the
// time before which a draft has expired, and ignore those last saved before it. Removing a member
// deletes theirs (MemberRepository.remove).
export interface SavedDraftRepository {
	// Stores a new draft. An import has at most one: a draft that continues it takes the place of the
	// import's earlier one, keeping its id, or returns null when that one is another member's.
	create(draft: NewSavedDraft): Promise<SavedDraft | null>;
	// Replaces the draft's contents, keeping its import and provenance, and marks it saved now.
	// Returns null when no draft has this id.
	update(id: SavedDraftId, contents: SavedDraftContents): Promise<SavedDraft | null>;
	findById(id: SavedDraftId): Promise<SavedDraft | null>;
	// The draft that continues the import, if any.
	findByImportId(importId: RecipeImportId): Promise<SavedDraft | null>;
	// The member's drafts saved since the given time, newest first, at most limit of them.
	list(memberId: MemberId, since: Date, limit: number): Promise<SavedDraftSummary[]>;
	// The given image pathnames that a draft saved since the given time names, ignoring the excluded
	// member's drafts.
	findImagesInUse(
		pathnames: readonly string[],
		since: Date,
		excludeMemberId?: MemberId
	): Promise<string[]>;
	// Returns the deleted draft, or null when no draft has this id.
	delete(id: SavedDraftId): Promise<SavedDraft | null>;
	deleteByImportId(importId: RecipeImportId): Promise<void>;
	// Deletes every draft last saved before the given time, and returns how many it deleted.
	deleteSavedBefore(cutoff: Date): Promise<number>;
}
