import 'server-only';
import type { InferModelFromColumns } from 'drizzle-orm';
import type { NewRecipe, StoredRecipe } from '@/application/ports/recipe-repository';
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
	chapter: recipes.chapter,
	holidays: recipes.holidays,
	diets: recipes.diets,
	createdAt: recipes.createdAt,
	updatedAt: recipes.updatedAt,
};

type RecipeRow = InferModelFromColumns<typeof recipeColumns>;

// The content's fields that leave the document for columns of their own.
type ColumnFields = Pick<RecipeContent, 'tags' | 'chapter' | 'holidays' | 'diets'>;

type ContentColumns = ColumnFields & {
	content: Omit<RecipeContent, keyof ColumnFields>;
};

function columnFields(row: RecipeRow): ColumnFields {
	return { tags: row.tags, chapter: row.chapter, holidays: row.holidays, diets: row.diets };
}

export function toContentColumns(content: RecipeContent): ContentColumns {
	const { tags, chapter, holidays, diets, ...document } = content;
	return { content: document, tags, chapter, holidays, diets };
}

export function toInsertColumns(recipe: NewRecipe, slug: string): typeof recipes.$inferInsert {
	return {
		slug,
		contributorId: recipe.contributorId,
		provenance: recipe.provenance,
		importId: recipe.importId,
		...toContentColumns(recipe.content),
	};
}

// Columns override same-named keys in the document. Unknown keys drop, and invalid documents throw.
export function toRecipe(row: RecipeRow): Recipe {
	return recipeSchema.parse({
		...(row.content as object),
		...columnFields(row),
		provenance: row.provenance,
		id: row.id,
		slug: row.slug,
		contributorId: row.contributorId,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	});
}

// The content as saved beside the recipe read from it, which validated it: reading changes no shape,
// only text, so the saved content has the content's shape.
export function toStoredRecipe(row: RecipeRow): StoredRecipe {
	const recipe = toRecipe(row);
	const document = row.content as ContentColumns['content'];
	return { recipe, storedContent: { ...document, ...columnFields(row) } };
}
