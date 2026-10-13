import 'server-only';
import type { InferModelFromColumns } from 'drizzle-orm';
import type { UnsavedImport } from '@/application/ports/recipe-import-repository';
import { recipeImportSchema, type RecipeImport } from '@/domain/recipe/recipe-import';
import { withoutNulls } from '@/infrastructure/db/nullable-columns';
import { recipeImports } from '@/infrastructure/db/schema';

// The import's own columns. Whether a recipe was saved from it lives on the recipe that points at it.
export const recipeImportColumns = {
	id: recipeImports.id,
	memberId: recipeImports.memberId,
	mode: recipeImports.mode,
	status: recipeImports.status,
	sourceUrl: recipeImports.sourceUrl,
	aiModel: recipeImports.aiModel,
	costUsd: recipeImports.costUsd,
	failure: recipeImports.failure,
	draft: recipeImports.draft,
	createdAt: recipeImports.createdAt,
};

type RecipeImportRow = InferModelFromColumns<typeof recipeImportColumns>;

export const unsavedImportColumns = {
	id: recipeImports.id,
	mode: recipeImports.mode,
	draft: recipeImports.draft,
	createdAt: recipeImports.createdAt,
};

type UnsavedImportRow = InferModelFromColumns<typeof unsavedImportColumns>;

// An unsaved import's row, whose draft the query found present.
const unsavedImportRowSchema = recipeImportSchema
	.pick({ id: true, mode: true, draft: true, createdAt: true })
	.required({ draft: true });

// savedRecipeSlug is the slug of the recipe whose import_id points at the import. Invalid rows and
// drafts throw.
export function toRecipeImport(row: RecipeImportRow, savedRecipeSlug: string | null): RecipeImport {
	return recipeImportSchema.parse(withoutNulls({ ...row, savedRecipeSlug }));
}

// The draft is validated whole, though the list shows only its title. Invalid rows and drafts throw.
export function toUnsavedImport(row: UnsavedImportRow): UnsavedImport {
	const { draft, ...fields } = unsavedImportRowSchema.parse(row);
	const { title } = draft.content;
	return { ...fields, ...(title !== undefined && { title }) };
}
