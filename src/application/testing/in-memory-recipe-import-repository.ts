import type { SavedDraftId } from '@/application/drafts/saved-draft';
import type {
	ImportFailure,
	ImportSuccess,
	NewRecipeImport,
	RecipeImportLimit,
	RecipeImportRepository,
} from '@/application/ports/recipe-import-repository';
import type { InMemoryRecipeRepository } from '@/application/testing/in-memory-recipe-repository';
import type { InMemorySavedDraftRepository } from '@/application/testing/in-memory-saved-draft-repository';
import type { MemberId } from '@/domain/member/member';
import {
	recipeImportIdSchema,
	type RecipeImport,
	type RecipeImportId,
} from '@/domain/recipe/recipe-import';

// An import as stored: whether a recipe was saved from it is read from the recipes.
type StoredImport = Omit<RecipeImport, 'savedRecipeSlug'>;

export class InMemoryRecipeImportRepository implements RecipeImportRepository {
	// Insertion order is creation order.
	private readonly imports = new Map<RecipeImportId, StoredImport>();
	private readonly recipes: InMemoryRecipeRepository;
	private readonly drafts: InMemorySavedDraftRepository;

	// The recipes saved from imports, as the database joins them, and the drafts a success makes, as
	// the database's success does in its transaction.
	constructor(recipes: InMemoryRecipeRepository, drafts: InMemorySavedDraftRepository) {
		this.recipes = recipes;
		this.drafts = drafts;
	}

	async start(
		recipeImport: NewRecipeImport,
		limit?: RecipeImportLimit
	): Promise<RecipeImport | null> {
		if (limit !== undefined && this.countWithin(recipeImport.memberId, limit) >= limit.maxImports) {
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

	// The draft is stored first, so an import whose draft is refused stays running.
	async recordSuccess(
		id: RecipeImportId,
		{ draft, ...success }: ImportSuccess
	): Promise<SavedDraftId | null> {
		const stored = this.imports.get(id);
		if (stored?.status !== 'running') {
			return null;
		}

		const created = this.drafts.storeImported(stored.memberId, id, draft);
		this.imports.set(id, { ...stored, ...success, status: 'succeeded' });
		return created.id;
	}

	async recordFailure(id: RecipeImportId, failure: ImportFailure): Promise<boolean> {
		const stored = this.imports.get(id);
		if (stored?.status !== 'running') {
			return false;
		}

		this.imports.set(id, { ...stored, ...failure, status: 'failed' });
		return true;
	}

	async findById(id: RecipeImportId): Promise<RecipeImport | null> {
		const stored = this.imports.get(id);
		if (stored === undefined) {
			return null;
		}

		const saved = this.recipes.findByImportId(id);
		return saved === null ? stored : { ...stored, savedRecipeSlug: saved.slug };
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

	private countWithin(
		memberId: MemberId,
		{ since, uncountedFailures = [] }: RecipeImportLimit
	): number {
		return [...this.imports.values()].filter(
			(stored) =>
				stored.memberId === memberId &&
				stored.createdAt >= since &&
				(stored.failure === undefined || !uncountedFailures.includes(stored.failure))
		).length;
	}
}
