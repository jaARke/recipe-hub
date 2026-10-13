import 'server-only';
import type { RecipeImportRepository } from '@/application/ports/recipe-import-repository';
import type { RecipeRepository } from '@/application/ports/recipe-repository';
import type { MemberId } from '@/domain/member/member';
import { importDraftCutoff } from '@/domain/recipe/recipe-import';

// The given pathnames that a recipe lists or an unexpired import's draft names, as importing the same
// scans twice makes drafts share them, ignoring the excluded member's recipes and drafts. Drafts are
// read before recipes, so a draft saved as a recipe in between is found as the recipe.
export async function imagesInUse(
	pathnames: readonly string[],
	recipes: RecipeRepository,
	imports: RecipeImportRepository,
	now: Date,
	excludeMemberId?: MemberId
): Promise<Set<string>> {
	const inDrafts = await imports.findImagesInUnsavedImports(
		pathnames,
		importDraftCutoff(now),
		excludeMemberId
	);
	const inRecipes = await recipes.findImagesInUse(pathnames, excludeMemberId);
	return new Set([...inDrafts, ...inRecipes]);
}
