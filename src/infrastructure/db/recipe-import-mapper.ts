import 'server-only';
import type { InferModelFromColumns } from 'drizzle-orm';
import { recipeImportSchema, type RecipeImport } from '@/domain/recipe/recipe-import';
import { withoutNulls } from '@/infrastructure/db/nullable-columns';
import { recipeImports } from '@/infrastructure/db/schema';

// The import's own columns. Whether a recipe was saved from it lives on the recipe that points at it.
export const recipeImportColumns = {
	id: recipeImports.id,
	memberId: recipeImports.memberId,
	mode: recipeImports.mode,
	status: recipeImports.status,
	aiModel: recipeImports.aiModel,
	costUsd: recipeImports.costUsd,
	failure: recipeImports.failure,
	createdAt: recipeImports.createdAt,
};

type RecipeImportRow = InferModelFromColumns<typeof recipeImportColumns>;

// savedRecipeSlug is the slug of the recipe whose import_id points at the import. Invalid rows throw.
export function toRecipeImport(row: RecipeImportRow, savedRecipeSlug: string | null): RecipeImport {
	return recipeImportSchema.parse(withoutNulls({ ...row, savedRecipeSlug }));
}
