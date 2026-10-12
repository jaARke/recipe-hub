import 'server-only';
import { and, arrayOverlaps, eq, ne, or, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type {
	NewRecipe,
	RecipePage,
	RecipeRepository,
} from '@/application/ports/recipe-repository';
import type { Recipe, RecipeContent, RecipeId } from '@/domain/recipe/recipe';
import { slugCandidate } from '@/domain/recipe/slug';
import { tagKey } from '@/domain/recipe/tag';
import {
	recipeColumns,
	toContentColumns,
	toInsertColumns,
	toRecipe,
} from '@/infrastructure/db/recipe-mapper';
import { recipeOrders } from '@/infrastructure/db/recipe-order';
import { recipes } from '@/infrastructure/db/schema';

export class DrizzleRecipeRepository implements RecipeRepository {
	private readonly db: PgDatabase<PgQueryResultHKT>;

	constructor(db: PgDatabase<PgQueryResultHKT>) {
		this.db = db;
	}

	async findById(id: RecipeId): Promise<Recipe | null> {
		const [row] = await this.db.select(recipeColumns).from(recipes).where(eq(recipes.id, id));
		return row === undefined ? null : toRecipe(row);
	}

	async findBySlug(slug: string): Promise<Recipe | null> {
		const [row] = await this.db.select(recipeColumns).from(recipes).where(eq(recipes.slug, slug));
		return row === undefined ? null : toRecipe(row);
	}

	async list(page: RecipePage): Promise<Recipe[]> {
		const rows = await this.db
			.select(recipeColumns)
			.from(recipes)
			.orderBy(...recipeOrders[page.sort])
			.limit(page.limit)
			.offset(page.offset);
		return rows.map(toRecipe);
	}

	async count(): Promise<number> {
		return this.db.$count(recipes);
	}

	async create(recipe: NewRecipe): Promise<Recipe> {
		const taken = await this.findTakenSlugs(recipe.slugBase);

		// A conflict means a concurrent insert took the candidate, so the next one is tried.
		for (let attempt = 1; ; attempt += 1) {
			const slug = slugCandidate(recipe.slugBase, attempt);
			if (taken.has(slug)) {
				continue;
			}

			const [row] = await this.db
				.insert(recipes)
				.values(toInsertColumns(recipe, slug))
				.onConflictDoNothing({ target: recipes.slug })
				.returning(recipeColumns);
			if (row !== undefined) {
				return toRecipe(row);
			}
		}
	}

	async update(id: RecipeId, content: RecipeContent): Promise<Recipe | null> {
		const [row] = await this.db
			.update(recipes)
			.set({ ...toContentColumns(content), updatedAt: sql`now()` })
			.where(eq(recipes.id, id))
			.returning(recipeColumns);
		return row === undefined ? null : toRecipe(row);
	}

	async delete(id: RecipeId): Promise<boolean> {
		const rows = await this.db
			.delete(recipes)
			.where(eq(recipes.id, id))
			.returning({ id: recipes.id });
		return rows.length > 0;
	}

	async findTagLabels(keys: readonly string[], excludeRecipeId?: RecipeId): Promise<string[]> {
		const wanted = new Set(keys);
		if (wanted.size === 0) {
			return [];
		}

		// The tag key index narrows the recipes, and tagKey stays the one definition of a tag.
		const rows = await this.db
			.selectDistinct({ label: sql<string>`unnest(${recipes.tags})` })
			.from(recipes)
			.where(
				and(
					arrayOverlaps(recipes.tagKeys, [...wanted]),
					excludeRecipeId === undefined ? undefined : ne(recipes.id, excludeRecipeId)
				)
			);
		return rows.map(({ label }) => label).filter((label) => wanted.has(tagKey(label)));
	}

	// The base and its numbered candidates. A long base's candidates are truncated and can escape
	// this lookup, which only costs a retry, since the insert itself resolves conflicts.
	private async findTakenSlugs(slugBase: string): Promise<Set<string>> {
		const rows = await this.db
			.select({ slug: recipes.slug })
			.from(recipes)
			.where(or(eq(recipes.slug, slugBase), sql`starts_with(${recipes.slug}, ${`${slugBase}-`})`));
		return new Set(rows.map(({ slug }) => slug));
	}
}
