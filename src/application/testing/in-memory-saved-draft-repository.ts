import { SavedDraftEditConflictError } from '@/application/drafts/errors';
import { savedDraftIdSchema, type SavedDraftId } from '@/application/drafts/saved-draft';
import type {
	NewImportedDraft,
	NewSavedDraft,
	SavedDraft,
	SavedDraftContents,
	SavedDraftRepository,
	SavedDraftSummary,
	SavedDraftUpdate,
} from '@/application/ports/saved-draft-repository';
import type { MemberId } from '@/domain/member/member';
import type { RecipeImportId } from '@/domain/recipe/recipe-import';

// What a draft keeps whatever its contents are.
type DraftRecord = Omit<SavedDraft, keyof SavedDraftContents | 'imported'>;

function newDraftId(): SavedDraftId {
	return savedDraftIdSchema.parse(crypto.randomUUID());
}

// The draft as a write leaves it: a title left out is none, and the values a copy, as the database
// stores its own.
function withContents(
	draft: DraftRecord,
	{ title, values, imagePathnames }: SavedDraftContents
): SavedDraft {
	return {
		...draft,
		...(title !== undefined && { title }),
		values: structuredClone(values),
		imagePathnames: [...imagePathnames],
	};
}

// Each write changes its draft without awaiting, so concurrent calls take turns as the database's do.
export class InMemorySavedDraftRepository implements SavedDraftRepository {
	// Insertion order is creation order.
	private readonly drafts = new Map<SavedDraftId, SavedDraft>();

	async create({ memberId, ...contents }: NewSavedDraft): Promise<SavedDraft> {
		const createdAt = new Date();
		return this.store(
			withContents({ id: newDraftId(), memberId, createdAt, updatedAt: createdAt }, contents)
		);
	}

	async update(
		id: SavedDraftId,
		{ expectedUpdatedAt, ...contents }: SavedDraftUpdate
	): Promise<SavedDraft | null> {
		const stored = this.storedAt(id, expectedUpdatedAt);
		if (stored === undefined) {
			return null;
		}

		return this.store(
			withContents(
				{
					id: stored.id,
					memberId: stored.memberId,
					...(stored.importId !== undefined && { importId: stored.importId }),
					...(stored.provenance !== undefined && { provenance: stored.provenance }),
					createdAt: stored.createdAt,
					// Later by a millisecond at least, so saves within one millisecond are still new versions.
					updatedAt: new Date(Math.max(Date.now(), stored.updatedAt.getTime() + 1)),
				},
				contents
			)
		);
	}

	async findById(id: SavedDraftId): Promise<SavedDraft | null> {
		return this.drafts.get(id) ?? null;
	}

	async findByImportId(importId: RecipeImportId): Promise<SavedDraft | null> {
		return this.findWithImport(importId) ?? null;
	}

	async list(memberId: MemberId, since: Date): Promise<SavedDraftSummary[]> {
		// Reversed first, so the stable sort lists drafts saved in the same millisecond newest first.
		return [...this.drafts.values()]
			.filter((draft) => draft.memberId === memberId && draft.updatedAt >= since)
			.reverse()
			.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
			.map(({ id, provenance, title, updatedAt }) => ({
				id,
				...(provenance !== undefined && { provenance }),
				...(title !== undefined && { title }),
				updatedAt,
			}));
	}

	async count(memberId: MemberId, since: Date): Promise<number> {
		return [...this.drafts.values()].filter(
			(draft) => draft.memberId === memberId && draft.updatedAt >= since
		).length;
	}

	async findImagesInUse(
		pathnames: readonly string[],
		since: Date,
		excludeMemberId?: MemberId
	): Promise<string[]> {
		const named = new Set(
			[...this.drafts.values()]
				.filter((draft) => draft.memberId !== excludeMemberId && draft.updatedAt >= since)
				.flatMap((draft) => draft.imagePathnames)
		);
		return [...new Set(pathnames)].filter((pathname) => named.has(pathname));
	}

	async delete(id: SavedDraftId, expectedUpdatedAt: Date): Promise<SavedDraft | null> {
		const stored = this.storedAt(id, expectedUpdatedAt);
		if (stored === undefined) {
			return null;
		}

		this.drafts.delete(id);
		return stored;
	}

	async deleteSavedBefore(cutoff: Date): Promise<number> {
		let deleted = 0;
		for (const draft of this.drafts.values()) {
			if (draft.updatedAt < cutoff) {
				this.drafts.delete(draft.id);
				deleted += 1;
			}
		}
		return deleted;
	}

	// Stands in for the insert an import's success makes in its transaction, and throws as the import's
	// unique key does when the import already has a draft. It does not await, so the success stays one
	// uninterrupted step.
	storeImported(
		memberId: MemberId,
		importId: RecipeImportId,
		{ provenance, title, imported, imagePathnames }: NewImportedDraft
	): SavedDraft {
		if (this.findWithImport(importId) !== undefined) {
			throw new Error('The import already has a draft');
		}

		const createdAt = new Date();
		return this.store({
			id: newDraftId(),
			memberId,
			importId,
			provenance,
			...(title !== undefined && { title }),
			imported: structuredClone(imported),
			imagePathnames: [...imagePathnames],
			createdAt,
			updatedAt: createdAt,
		});
	}

	// Stands in for the delete a member's removal makes in its transaction. It does not await, so the
	// removal stays one uninterrupted step.
	removeAllOf(memberId: MemberId): void {
		for (const draft of this.drafts.values()) {
			if (draft.memberId === memberId) {
				this.drafts.delete(draft.id);
			}
		}
	}

	// Stands in for a test moving updated_at back in the database.
	backdate(id: SavedDraftId, updatedAt: Date): void {
		const stored = this.drafts.get(id);
		if (stored === undefined) {
			throw new Error('No draft has this id');
		}

		this.drafts.set(id, { ...stored, updatedAt });
	}

	// The draft a write at a version acts on, if there is one; one saved since is a conflict.
	private storedAt(id: SavedDraftId, expectedUpdatedAt: Date): SavedDraft | undefined {
		const stored = this.drafts.get(id);
		if (stored !== undefined && stored.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
			throw new SavedDraftEditConflictError();
		}
		return stored;
	}

	private findWithImport(importId: RecipeImportId): SavedDraft | undefined {
		return [...this.drafts.values()].find((draft) => draft.importId === importId);
	}

	private store(draft: SavedDraft): SavedDraft {
		this.drafts.set(draft.id, draft);
		return draft;
	}
}
