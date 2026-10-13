import 'server-only';
import type { Problem } from '@/domain/problem';
import type { RecipeDraftContent } from '@/domain/recipe/recipe-draft';
import type {
	ImportDraft,
	RecipeImport,
	RecipeImportId,
	RecipeImportMode,
} from '@/domain/recipe/recipe-import';

// Returned by an import, so the caller can open its review page.
export type RecipeImportRef = {
	id: RecipeImportId;
};

// An import's draft, for the member who started it to review in the recipe form.
export type ImportDraftDto = {
	id: RecipeImportId;
	mode: RecipeImportMode;
	// For a URL import, the page the recipe was read from.
	sourceUrl?: string;
	content: RecipeDraftContent;
	problems: Problem[];
};

// What an import id leads to: its draft, or the recipe already saved from it.
export type ImportReviewDto =
	{ status: 'reviewable'; draft: ImportDraftDto } | { status: 'saved'; recipeSlug: string };

// A draft the member has not saved yet, as the Drafts tab lists it.
export type UnsavedImportDto = {
	id: RecipeImportId;
	mode: RecipeImportMode;
	title?: string;
	createdAt: Date;
};

export function toImportDraftDto(recipeImport: RecipeImport, draft: ImportDraft): ImportDraftDto {
	return {
		id: recipeImport.id,
		mode: recipeImport.mode,
		...(recipeImport.sourceUrl !== undefined && { sourceUrl: recipeImport.sourceUrl }),
		content: draft.content,
		problems: draft.problems,
	};
}
