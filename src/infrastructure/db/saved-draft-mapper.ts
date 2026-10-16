import 'server-only';
import type { InferModelFromColumns } from 'drizzle-orm';
import { z } from 'zod';
import { savedDraftIdSchema } from '@/application/drafts/saved-draft';
import type { SavedDraft, SavedDraftSummary } from '@/application/ports/saved-draft-repository';
import { memberIdSchema } from '@/domain/member/member';
import { provenanceSchema } from '@/domain/recipe/provenance';
import { recipeImportIdSchema } from '@/domain/recipe/recipe-import';
import { withoutNulls } from '@/infrastructure/db/nullable-columns';
import { recipeDrafts } from '@/infrastructure/db/schema';

export const savedDraftColumns = {
	id: recipeDrafts.id,
	memberId: recipeDrafts.memberId,
	importId: recipeDrafts.importId,
	provenance: recipeDrafts.provenance,
	title: recipeDrafts.title,
	values: recipeDrafts.values,
	imagePathnames: recipeDrafts.imagePathnames,
	createdAt: recipeDrafts.createdAt,
	updatedAt: recipeDrafts.updatedAt,
};

type SavedDraftRow = InferModelFromColumns<typeof savedDraftColumns>;

export const savedDraftSummaryColumns = {
	id: recipeDrafts.id,
	importId: recipeDrafts.importId,
	provenance: recipeDrafts.provenance,
	title: recipeDrafts.title,
	updatedAt: recipeDrafts.updatedAt,
};

type SavedDraftSummaryRow = InferModelFromColumns<typeof savedDraftSummaryColumns>;

// The values are the recipe form's, which it checks as it reads them.
const savedDraftSchema = z.object({
	id: savedDraftIdSchema,
	memberId: memberIdSchema,
	importId: recipeImportIdSchema.optional(),
	provenance: provenanceSchema.optional(),
	title: z.string().optional(),
	values: z.unknown(),
	imagePathnames: z.array(z.string()),
	createdAt: z.date(),
	updatedAt: z.date(),
}) satisfies z.ZodType<SavedDraft>;

const savedDraftSummarySchema = savedDraftSchema.pick({
	id: true,
	importId: true,
	provenance: true,
	title: true,
	updatedAt: true,
}) satisfies z.ZodType<SavedDraftSummary>;

// Invalid rows throw.
export function toSavedDraft(row: SavedDraftRow): SavedDraft {
	return savedDraftSchema.parse(withoutNulls(row));
}

export function toSavedDraftSummary(row: SavedDraftSummaryRow): SavedDraftSummary {
	return savedDraftSummarySchema.parse(withoutNulls(row));
}
