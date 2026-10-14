import { z } from 'zod';
import { memberIdSchema } from '@/domain/member/member';
import { problemSchema } from '@/domain/problem';
import type { Provenance } from '@/domain/recipe/provenance';
import { recipeDraftContentSchema, type RecipeDraft } from '@/domain/recipe/recipe-draft';
import { slugSchema } from '@/domain/recipe/slug';
import { nonEmptyTextSchema } from '@/domain/text';
import { daysInMilliseconds } from '@/lib/dates';
import { settings } from '@/lib/settings';

export const recipeImportIdSchema = z.uuid().brand<'RecipeImportId'>();
export type RecipeImportId = z.infer<typeof recipeImportIdSchema>;

export const recipeImportModes = ['url', 'photo'] as const;
export type RecipeImportMode = (typeof recipeImportModes)[number];

export const recipeImportStatuses = ['running', 'succeeded', 'failed'] as const;

// What an import produced for review. The problems include the model's notes on what to check.
export const importDraftSchema = z.object({
	content: recipeDraftContentSchema,
	problems: z.array(problemSchema),
});
export type ImportDraft = z.infer<typeof importDraftSchema>;

// A member's import, kept as a record of use and cost. Its draft and source URL are cleared once a
// recipe is saved from it or the draft expires.
export const recipeImportSchema = z.object({
	id: recipeImportIdSchema,
	memberId: memberIdSchema,
	mode: z.enum(recipeImportModes),
	status: z.enum(recipeImportStatuses),
	// The address a URL import read the page from.
	sourceUrl: z.httpUrl().optional(),
	// The model that answered, when one read the recipe.
	aiModel: nonEmptyTextSchema.optional(),
	// What the model calls cost in US dollars, as the gateway reported it.
	costUsd: z.number().nonnegative().optional(),
	// The code of the error that ended a failed import.
	failure: z.string().min(1).optional(),
	draft: importDraftSchema.optional(),
	// The current slug of the recipe saved from it.
	savedRecipeSlug: slugSchema.optional(),
	createdAt: z.date(),
});
export type RecipeImport = z.infer<typeof recipeImportSchema>;

// Drafts of imports started before this time have expired.
export function importDraftCutoff(now: Date): Date {
	return new Date(now.getTime() - daysInMilliseconds(settings.imports.importDraftLifetimeDays));
}

// A URL import's provenance needs its source URL, which is cleared with the draft.
function importProvenance({ mode, sourceUrl, aiModel }: RecipeImport): Provenance | null {
	const model = aiModel === undefined ? {} : { aiModel };
	if (mode === 'photo') {
		return { entryMode: 'photo', ...model };
	}

	return sourceUrl === undefined ? null : { entryMode: 'url', sourceUrl, ...model };
}

// The draft a member can still review and save, with the provenance its recipe takes. Null when the
// import did not succeed, a recipe was saved from it, or its draft was cleared or has expired.
export function reviewableDraft(recipeImport: RecipeImport, now: Date): RecipeDraft | null {
	const { status, draft, savedRecipeSlug, createdAt } = recipeImport;
	if (
		status !== 'succeeded' ||
		draft === undefined ||
		savedRecipeSlug !== undefined ||
		createdAt < importDraftCutoff(now)
	) {
		return null;
	}

	const provenance = importProvenance(recipeImport);
	return provenance === null ? null : { ...draft, provenance };
}
