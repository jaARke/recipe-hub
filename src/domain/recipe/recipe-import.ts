import { z } from 'zod';
import { memberIdSchema } from '@/domain/member/member';
import { problemSchema } from '@/domain/problem';
import type { Provenance } from '@/domain/recipe/provenance';
import { recipeDraftContentSchema } from '@/domain/recipe/recipe-draft';
import { slugSchema } from '@/domain/recipe/slug';
import { blankTextMessage, plainTextSchema } from '@/domain/text';

export const recipeImportIdSchema = z.uuid().brand<'RecipeImportId'>();
export type RecipeImportId = z.infer<typeof recipeImportIdSchema>;

export const recipeImportModes = ['url', 'photo'] as const;
export type RecipeImportMode = (typeof recipeImportModes)[number];

export const recipeImportStatuses = ['running', 'succeeded', 'failed'] as const;

// What an import given nothing to read is told: a blank link, keyed by the field, or no photos. The
// browser checks for each before sending and says the same.
export const urlImportBlankMessages = { url: blankTextMessage('a link to the recipe') };
export const noScansMessage = 'Add at least one photo.';

// What an import read, which the draft it makes opens with until the recipe form saves its own
// values. The problems include the model's notes on what to check.
export const importDraftSchema = z.object({
	content: recipeDraftContentSchema,
	problems: z.array(problemSchema),
});
export type ImportDraft = z.infer<typeof importDraftSchema>;

// Where an import read the recipe: the page at the address the member gave, or their photos.
export type ImportedFrom = { mode: 'url'; sourceUrl: string } | { mode: 'photo' };

// A member's import, kept as a record of use and cost. What it read lives on the draft it made.
export const recipeImportSchema = z.object({
	id: recipeImportIdSchema,
	memberId: memberIdSchema,
	mode: z.enum(recipeImportModes),
	status: z.enum(recipeImportStatuses),
	// The model that answered, when one read the recipe.
	aiModel: plainTextSchema.optional(),
	// What the model calls cost in US dollars, as the gateway reported it.
	costUsd: z.number().nonnegative().optional(),
	// The code of the error that ended a failed import.
	failure: z.string().min(1).optional(),
	// The current slug of the recipe saved from it.
	savedRecipeSlug: slugSchema.optional(),
	createdAt: z.date(),
});
export type RecipeImport = z.infer<typeof recipeImportSchema>;

// The provenance a recipe read by an import takes, which its draft keeps: the page's address for a
// link, and the model that read it, when one did.
export function importProvenance(source: ImportedFrom, aiModel: string | undefined): Provenance {
	const model = aiModel === undefined ? {} : { aiModel };
	return source.mode === 'url'
		? { entryMode: 'url', sourceUrl: source.sourceUrl, ...model }
		: { entryMode: 'photo', ...model };
}
