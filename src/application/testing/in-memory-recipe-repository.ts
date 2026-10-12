import type {
	NewRecipe,
	RecipePage,
	RecipeRepository,
	RecipeSort,
	RecipeUpdate,
	UpdatedRecipe,
} from '@/application/ports/recipe-repository';
import { RecipeEditConflictError } from '@/application/recipes/errors';
import { recipeIdSchema, type Recipe, type RecipeId } from '@/domain/recipe/recipe';
import { slugCandidate } from '@/domain/recipe/slug';
import { tagKey } from '@/domain/recipe/tag';

// Mirrors the database's title sort key: lowercased, with accents stripped.
function titleSortKey(recipe: Recipe): string {
	return recipe.title.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

function compareText(a: string, b: string): number {
	return a < b ? -1 : a > b ? 1 : 0;
}

export class InMemoryRecipeRepository implements RecipeRepository {
	private readonly recipes = new Map<RecipeId, Recipe>();
	// Each old slug and the recipe it now names.
	private readonly oldSlugs = new Map<string, RecipeId>();

	async findById(id: RecipeId): Promise<Recipe | null> {
		return this.recipes.get(id) ?? null;
	}

	async findBySlug(slug: string): Promise<Recipe | null> {
		const current = [...this.recipes.values()].find((recipe) => recipe.slug === slug);
		if (current !== undefined) {
			return current;
		}

		const renamedId = this.oldSlugs.get(slug);
		return renamedId === undefined ? null : (this.recipes.get(renamedId) ?? null);
	}

	async list(page: RecipePage): Promise<Recipe[]> {
		return this.sorted(page.sort).slice(page.offset, page.offset + page.limit);
	}

	async count(): Promise<number> {
		return this.recipes.size;
	}

	async create(recipe: NewRecipe): Promise<Recipe> {
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

		this.recipes.delete(id);
		return existing;
	}

	async findTagLabels(keys: readonly string[], excludeRecipeId?: RecipeId): Promise<string[]> {
		const wanted = new Set(keys);
		const labels = [...this.recipes.values()]
			.filter((recipe) => recipe.id !== excludeRecipeId)
			.flatMap((recipe) => recipe.tags)
			.filter((label) => wanted.has(tagKey(label)));

		return [...new Set(labels)];
	}

	async findImagesInUse(pathnames: readonly string[]): Promise<string[]> {
		const listed = new Set(
			[...this.recipes.values()].flatMap((recipe) => recipe.images.map(({ pathname }) => pathname))
		);
		return [...new Set(pathnames)].filter((pathname) => listed.has(pathname));
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
