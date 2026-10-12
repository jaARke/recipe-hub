import type {
	NewRecipe,
	RecipePage,
	RecipeRepository,
	RecipeSort,
} from '@/application/ports/recipe-repository';
import {
	recipeIdSchema,
	type Recipe,
	type RecipeContent,
	type RecipeId,
} from '@/domain/recipe/recipe';
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

	async findById(id: RecipeId): Promise<Recipe | null> {
		return this.recipes.get(id) ?? null;
	}

	async findBySlug(slug: string): Promise<Recipe | null> {
		return [...this.recipes.values()].find((recipe) => recipe.slug === slug) ?? null;
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

	async update(id: RecipeId, content: RecipeContent): Promise<Recipe | null> {
		const existing = this.recipes.get(id);
		if (existing === undefined) {
			return null;
		}

		const updated: Recipe = {
			...content,
			id: existing.id,
			slug: existing.slug,
			contributorId: existing.contributorId,
			provenance: existing.provenance,
			createdAt: existing.createdAt,
			updatedAt: new Date(),
		};

		this.recipes.set(id, updated);
		return updated;
	}

	async delete(id: RecipeId): Promise<boolean> {
		return this.recipes.delete(id);
	}

	async findTagLabels(keys: readonly string[], excludeRecipeId?: RecipeId): Promise<string[]> {
		const wanted = new Set(keys);
		const labels = [...this.recipes.values()]
			.filter((recipe) => recipe.id !== excludeRecipeId)
			.flatMap((recipe) => recipe.tags)
			.filter((label) => wanted.has(tagKey(label)));

		return [...new Set(labels)];
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

	private freeSlug(base: string): string {
		const taken = new Set([...this.recipes.values()].map((recipe) => recipe.slug));
		for (let attempt = 1; ; attempt += 1) {
			const candidate = slugCandidate(base, attempt);
			if (!taken.has(candidate)) {
				return candidate;
			}
		}
	}
}
