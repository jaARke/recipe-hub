import 'server-only';
import type { InferModelFromColumns } from 'drizzle-orm';
import type { NewRecipe } from '@/application/ports/recipe-repository';
import { recipeSchema, type Recipe, type RecipeContent } from '@/domain/recipe/recipe';
import { recipes } from '@/infrastructure/db/schema';

// What every recipe read selects and returns; the search columns exist only for queries.
export const recipeColumns = {
	id: recipes.id,
	slug: recipes.slug,
	contributorId: recipes.contributorId,
	content: recipes.content,
	provenance: recipes.provenance,
	tags: recipes.tags,
	createdAt: recipes.createdAt,
	updatedAt: recipes.updatedAt,
};

type RecipeRow = InferModelFromColumns<typeof recipeColumns>;

// Tags leave the content document for their own column.
type ContentColumns = {
	content: Omit<RecipeContent, 'tags'>;
	tags: string[];
};

export function toContentColumns(content: RecipeContent): ContentColumns {
	const { tags, ...document } = content;
	return { content: document, tags };
}

export function toInsertColumns(recipe: NewRecipe, slug: string): typeof recipes.$inferInsert {
	return {
		slug,
		contributorId: recipe.contributorId,
		provenance: recipe.provenance,
		...toContentColumns(recipe.content),
	};
}

// Columns override same-named keys in the document. Unknown keys drop, and invalid documents throw.
export function toRecipe(row: RecipeRow): Recipe {
	return recipeSchema.parse({
		...(row.content as object),
		tags: row.tags,
		provenance: row.provenance,
		id: row.id,
		slug: row.slug,
		contributorId: row.contributorId,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	});
}
