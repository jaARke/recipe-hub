import { savedDraftIdSchema, type SavedDraftId } from '@/application/drafts/saved-draft';
import type {
	NewSavedDraft,
	SavedDraft,
	SavedDraftContents,
	SavedDraftRepository,
	SavedDraftSummary,
} from '@/application/ports/saved-draft-repository';
import type { MemberId } from '@/domain/member/member';
import type { RecipeImportId } from '@/domain/recipe/recipe-import';

// The draft as a write leaves it: a title left out is none, and the values a copy, as the database
// stores its own.
function withContents(
	draft: Omit<SavedDraft, keyof SavedDraftContents>,
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

	async create(draft: NewSavedDraft): Promise<SavedDraft | null> {
		const { memberId, importId, ...contents } = draft;
		const continued = importId === undefined ? undefined : this.findWithImport(importId);
		if (continued !== undefined) {
			if (continued.memberId !== memberId) {
				return null;
			}
			return this.store(
				withContents(
					{
						id: continued.id,
						memberId,
						importId,
						createdAt: continued.createdAt,
						updatedAt: new Date(),
					},
					contents
				)
			);
		}

		const createdAt = new Date();
		return this.store(
			withContents(
				{
					id: savedDraftIdSchema.parse(crypto.randomUUID()),
					memberId,
					...(importId !== undefined && { importId }),
					createdAt,
					updatedAt: createdAt,
				},
				contents
			)
		);
	}

	async update(id: SavedDraftId, contents: SavedDraftContents): Promise<SavedDraft | null> {
		const stored = this.drafts.get(id);
		if (stored === undefined) {
			return null;
		}

		return this.store(
			withContents(
				{
					id: stored.id,
					memberId: stored.memberId,
					...(stored.importId !== undefined && { importId: stored.importId }),
					createdAt: stored.createdAt,
					updatedAt: new Date(),
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

	async list(memberId: MemberId, since: Date, limit: number): Promise<SavedDraftSummary[]> {
		// Reversed first, so the stable sort lists drafts saved in the same millisecond newest first.
		return [...this.drafts.values()]
			.filter((draft) => draft.memberId === memberId && draft.updatedAt >= since)
			.reverse()
			.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
			.slice(0, limit)
			.map(({ id, importId, title, updatedAt }) => ({
				id,
				...(importId !== undefined && { importId }),
				...(title !== undefined && { title }),
				updatedAt,
			}));
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

	async delete(id: SavedDraftId): Promise<SavedDraft | null> {
		const stored = this.drafts.get(id);
		this.drafts.delete(id);
		return stored ?? null;
	}

	async deleteByImportId(importId: RecipeImportId): Promise<void> {
		const continued = this.findWithImport(importId);
		if (continued !== undefined) {
			this.drafts.delete(continued.id);
		}
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

	private findWithImport(importId: RecipeImportId): SavedDraft | undefined {
		return [...this.drafts.values()].find((draft) => draft.importId === importId);
	}

	private store(draft: SavedDraft): SavedDraft {
		this.drafts.set(draft.id, draft);
		return draft;
	}
}
