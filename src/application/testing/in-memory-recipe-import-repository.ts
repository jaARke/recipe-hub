import type {
	ImportFailure,
	ImportSuccess,
	NewRecipeImport,
	RecipeImportLimit,
	RecipeImportRepository,
	UnsavedImport,
} from '@/application/ports/recipe-import-repository';
import type { InMemoryRecipeRepository } from '@/application/testing/in-memory-recipe-repository';
import type { MemberId } from '@/domain/member/member';
import {
	recipeImportIdSchema,
	type RecipeImport,
	type RecipeImportId,
} from '@/domain/recipe/recipe-import';

// An import as stored: whether a recipe was saved from it is read from the recipes.
type StoredImport = Omit<RecipeImport, 'savedRecipeSlug'>;

// The record an import keeps once its draft and source URL are cleared.
function withoutDraft(stored: StoredImport): StoredImport {
	const kept = { ...stored };
	delete kept.draft;
	delete kept.sourceUrl;
	return kept;
}

export class InMemoryRecipeImportRepository implements RecipeImportRepository {
	// Insertion order is creation order.
	private readonly imports = new Map<RecipeImportId, StoredImport>();
	private readonly recipes: InMemoryRecipeRepository;

	// The recipes saved from imports, as the database joins them.
	constructor(recipes: InMemoryRecipeRepository) {
		this.recipes = recipes;
	}

	async start(
		recipeImport: NewRecipeImport,
		limit?: RecipeImportLimit
	): Promise<RecipeImport | null> {
		if (
			limit !== undefined &&
			this.countSince(recipeImport.memberId, limit.since) >= limit.maxImports
		) {
			return null;
		}

		const started: StoredImport = {
			...recipeImport,
			id: recipeImportIdSchema.parse(crypto.randomUUID()),
			status: 'running',
			createdAt: new Date(),
		};
		this.imports.set(started.id, started);
		return started;
	}

	async recordSuccess(id: RecipeImportId, success: ImportSuccess): Promise<boolean> {
		return this.finish(id, { ...success, status: 'succeeded' });
	}

	async recordFailure(id: RecipeImportId, failure: ImportFailure): Promise<boolean> {
		return this.finish(id, { ...failure, status: 'failed' });
	}

	async findById(id: RecipeImportId): Promise<RecipeImport | null> {
		const stored = this.imports.get(id);
		if (stored === undefined) {
			return null;
		}

		const saved = this.recipes.findByImportId(id);
		return saved === null ? stored : { ...stored, savedRecipeSlug: saved.slug };
	}

	async listUnsaved(memberId: MemberId, since: Date, limit: number): Promise<UnsavedImport[]> {
		// Reversed first, so the stable sort lists imports started in the same millisecond newest first.
		return [...this.imports.values()]
			.filter((stored) => stored.memberId === memberId && this.isUnsaved(stored, since))
			.reverse()
			.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
			.slice(0, limit)
			.map(({ id, mode, draft, createdAt }) => ({
				id,
				mode,
				...(draft?.content.title !== undefined && { title: draft.content.title }),
				createdAt,
			}));
	}

	async findImagesInUnsavedImports(
		pathnames: readonly string[],
		since: Date,
		excludeMemberId?: MemberId
	): Promise<string[]> {
		const named = new Set(
			[...this.imports.values()]
				.filter((stored) => stored.memberId !== excludeMemberId && this.isUnsaved(stored, since))
				.flatMap((stored) => stored.draft?.content.images?.map(({ pathname }) => pathname) ?? [])
		);
		return [...new Set(pathnames)].filter((pathname) => named.has(pathname));
	}

	async clearDraft(id: RecipeImportId): Promise<void> {
		const stored = this.imports.get(id);
		if (stored !== undefined) {
			this.imports.set(id, withoutDraft(stored));
		}
	}

	async clearDraftsCreatedBefore(cutoff: Date): Promise<number> {
		let cleared = 0;
		for (const stored of this.imports.values()) {
			if (
				stored.createdAt < cutoff &&
				(stored.draft !== undefined || stored.sourceUrl !== undefined)
			) {
				this.imports.set(stored.id, withoutDraft(stored));
				cleared += 1;
			}
		}
		return cleared;
	}

	async failRunningCreatedBefore(cutoff: Date, failure: string): Promise<number> {
		let failed = 0;
		for (const stored of this.imports.values()) {
			if (stored.status === 'running' && stored.createdAt < cutoff) {
				this.imports.set(stored.id, { ...stored, status: 'failed', failure });
				failed += 1;
			}
		}
		return failed;
	}

	// Stands in for a test moving created_at back in the database.
	backdate(id: RecipeImportId, createdAt: Date): void {
		const stored = this.imports.get(id);
		if (stored === undefined) {
			throw new Error('No import has this id');
		}

		this.imports.set(id, { ...stored, createdAt });
	}

	private countSince(memberId: MemberId, since: Date): number {
		return [...this.imports.values()].filter(
			(stored) => stored.memberId === memberId && stored.createdAt >= since
		).length;
	}

	private finish(id: RecipeImportId, changes: Partial<StoredImport>): boolean {
		const stored = this.imports.get(id);
		if (stored?.status !== 'running') {
			return false;
		}

		this.imports.set(id, { ...stored, ...changes });
		return true;
	}

	private isUnsaved(stored: StoredImport, since: Date): boolean {
		return (
			stored.status === 'succeeded' &&
			stored.draft !== undefined &&
			stored.createdAt >= since &&
			this.recipes.findByImportId(stored.id) === null
		);
	}
}
