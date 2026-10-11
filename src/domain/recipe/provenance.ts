import { z } from 'zod';
import { nonEmptyTextSchema } from '@/domain/recipe/text';

// How a recipe entered the catalog. Set at creation and not editable by members.
export const provenanceSchema = z.discriminatedUnion('entryMode', [
	z.object({ entryMode: z.literal('manual') }),
	z.object({
		entryMode: z.literal('url'),
		sourceUrl: z.httpUrl('Enter a web address that starts with http:// or https://.'),
		aiModel: nonEmptyTextSchema.optional(),
	}),
	z.object({ entryMode: z.literal('photo'), aiModel: nonEmptyTextSchema.optional() }),
]);
export type Provenance = z.infer<typeof provenanceSchema>;
