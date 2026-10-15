import { ImportUnavailableError } from '@/application/ingestion/errors';
import type {
	NewRecipe,
	RecipePage,
	RecipeRepository,
	RecipeSort,
	RecipeUpdate,
	StoredRecipe,
	UpdatedRecipe,
} from '@/application/ports/recipe-repository';
import { RecipeEditConflictError } from '@/application/recipes/errors';
import type { MemberId } from '@/domain/member/member';
import { recipeIdSchema, type Recipe, type RecipeId } from '@/domain/recipe/recipe';
import type { RecipeImportId } from '@/domain/recipe/recipe-import';
import { slugCandidate } from '@/domain/recipe/slug';
import { tagKey } from '@/domain/recipe/tag-normalization';

// Mirrors the database's title sort key: lowercased, with accents stripped.
function titleSortKey(recipe: Recipe): string {
	return recipe.title.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

function compareText(a: string, b: string): number {
	return a < b ? -1 : a > b ? 1 : 0;
}

// A tag in use, with the earliest recipe's spelling as its label.
type TagUse = {
	key: string;
	label: string;
	recipeCount: number;
};

export class InMemoryRecipeRepository implements RecipeRepository {
	private readonly recipes = new Map<RecipeId, Recipe>();
	// Each old slug and the recipe it now names.
	private readonly oldSlugs = new Map<string, RecipeId>();
	// Each import a recipe was saved from, and that recipe.
	private readonly importIds = new Map<RecipeImportId, RecipeId>();

	async findById(id: RecipeId): Promise<Recipe | null> {
		return this.recipes.get(id) ?? null;
	}

	// Recipes are kept as saved and read without tidying, so a recipe is its own stored content.
	async findStoredById(id: RecipeId): Promise<StoredRecipe | null> {
		const recipe = this.recipes.get(id);
		return recipe === undefined ? null : { recipe, storedContent: recipe };
	}

	async findBySlug(slug: string): Promise<Recipe | null> {
		const current = [...this.recipes.values()].find((recipe) => recipe.slug === slug);
		if (current !== undefined) {
			return current;
		}

		const renamedId = this.oldSlugs.get(slug);
		return renamedId === undefined ? null : (this.recipes.get(renamedId) ?? null);
	}

	async findByIds(ids: readonly RecipeId[]): Promise<Recipe[]> {
		return [...new Set(ids)].flatMap((id) => this.recipes.get(id) ?? []);
	}

	async list(page: RecipePage): Promise<Recipe[]> {
		return this.sorted(page.sort).slice(page.offset, page.offset + page.limit);
	}

	async count(): Promise<number> {
		return this.recipes.size;
	}

	async create(recipe: NewRecipe): Promise<Recipe> {
		if (recipe.importId !== undefined && this.importIds.has(recipe.importId)) {
			throw new ImportUnavailableError();
		}

		const now = new Date();
		const created: Recipe = {
			...recipe.content,
			id: recipeIdSchema.parse(crypto.randomUUID()),
			slug: this.freeSlug(recipe.slugBase),
			contributorId: recipe.contributorId,
			provenance: recipe.provenance,
			createdAt: now,
			updatedAt: now,
		};

		this.recipes.set(created.id, created);
		if (recipe.importId !== undefined) {
			this.importIds.set(recipe.importId, created.id);
		}
		return created;
	}

	async update(id: RecipeId, update: RecipeUpdate): Promise<UpdatedRecipe | null> {
		const existing = this.recipes.get(id);
		if (existing === undefined) {
			return null;
		}

		if (existing.updatedAt.getTime() !== update.expectedUpdatedAt.getTime()) {
			throw new RecipeEditConflictError();
		}

		const slug = update.slugBase === undefined ? existing.slug : this.freeSlug(update.slugBase, id);
		if (slug !== existing.slug) {
			this.oldSlugs.delete(slug);
			this.oldSlugs.set(existing.slug, id);
		}

		const updated: Recipe = {
			...update.content,
			id: existing.id,
			slug,
			contributorId: existing.contributorId,
			provenance: existing.provenance,
			createdAt: existing.createdAt,
			// Later by a millisecond at least, so saves within one millisecond are still new versions.
			updatedAt: new Date(Math.max(Date.now(), existing.updatedAt.getTime() + 1)),
		};

		this.recipes.set(id, updated);
		return { recipe: updated, previousSlug: existing.slug };
	}

	async delete(id: RecipeId): Promise<Recipe | null> {
		const existing = this.recipes.get(id);
		if (existing === undefined) {
			return null;
		}

		for (const [slug, recipeId] of this.oldSlugs) {
			if (recipeId === id) {
				this.oldSlugs.delete(slug);
			}
		}
		for (const [importId, recipeId] of this.importIds) {
			if (recipeId === id) {
				this.importIds.delete(importId);
			}
		}

		this.recipes.delete(id);
		return existing;
	}

	async findTagLabels(keys: readonly string[], excludeRecipeId?: RecipeId): Promise<string[]> {
		const wanted = new Set(keys);
		return this.tagUses(excludeRecipeId)
			.filter(({ key }) => wanted.has(key))
			.map(({ label }) => label);
	}

	async listTagLabels(): Promise<string[]> {
		return this.tagUses()
			.sort((a, b) => b.recipeCount - a.recipeCount || compareText(a.key, b.key))
			.map(({ label }) => label);
	}

	async findImagesInUse(
		pathnames: readonly string[],
		excludeContributorId?: MemberId
	): Promise<string[]> {
		const listed = new Set(
			[...this.recipes.values()]
				.filter((recipe) => recipe.contributorId !== excludeContributorId)
				.flatMap((recipe) => recipe.images.map(({ pathname }) => pathname))
		);
		return [...new Set(pathnames)].filter((pathname) => listed.has(pathname));
	}

	// Stands in for the join the database makes from an import to the recipe saved from it.
	findByImportId(importId: RecipeImportId): Recipe | null {
		const recipeId = this.importIds.get(importId);
		return recipeId === undefined ? null : (this.recipes.get(recipeId) ?? null);
	}

	private sorted(sort: RecipeSort): Recipe[] {
		const recipes = [...this.recipes.values()];
		switch (sort) {
			case 'newest':
				// Reversed first, so the stable sort lists recipes created in the same millisecond newest first.
				return recipes.reverse().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
			case 'title':
				return recipes.sort(
					(a, b) => compareText(titleSortKey(a), titleSortKey(b)) || compareText(a.id, b.id)
				);
		}
	}

	// Earliest first, so the first spelling of a tag labels it. The stable sort keeps recipes created in
	// the same millisecond in the order they were created, as the database's time-ordered ids do.
	private tagUses(excludeRecipeId?: RecipeId): TagUse[] {
		const uses = new Map<string, TagUse>();
		const earliestFirst = [...this.recipes.values()].sort(
			(a, b) => a.createdAt.getTime() - b.createdAt.getTime()
		);
		for (const recipe of earliestFirst) {
			if (recipe.id === excludeRecipeId) {
				continue;
			}
			for (const label of recipe.tags) {
				const key = tagKey(label);
				const use = uses.get(key);
				uses.set(key, {
					key,
					label: use?.label ?? label,
					recipeCount: (use?.recipeCount ?? 0) + 1,
				});
			}
		}
		return [...uses.values()];
	}

	// A recipe's own slugs, current or old, are free for it.
	private freeSlug(base: string, recipeId?: RecipeId): string {
		const taken = new Set([
			...[...this.recipes.values()]
				.filter((recipe) => recipe.id !== recipeId)
				.map((recipe) => recipe.slug),
			...[...this.oldSlugs]
				.filter(([, oldSlugRecipeId]) => oldSlugRecipeId !== recipeId)
				.map(([slug]) => slug),
		]);
		for (let attempt = 1; ; attempt += 1) {
			const candidate = slugCandidate(base, attempt);
			if (!taken.has(candidate)) {
				return candidate;
			}
		}
	}
}
