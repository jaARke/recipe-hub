import { z } from 'zod';
import { hasNoNul, plainTextSchema } from '@/domain/text';

// What a source URL that isn't a web address is told.
export const invalidSourceUrlMessage = 'Enter a web address that starts with http:// or https://.';

// A source's web address: http or https and a named host, without the NUL character that Postgres
// text cannot hold.
export const sourceUrlSchema = z
	.httpUrl(invalidSourceUrlMessage)
	.refine(hasNoNul, invalidSourceUrlMessage);

// How a recipe entered the catalog. Set at creation and not editable by members.
export const provenanceSchema = z.discriminatedUnion('entryMode', [
	z.object({ entryMode: z.literal('manual') }),
	z.object({
		entryMode: z.literal('url'),
		sourceUrl: sourceUrlSchema,
		aiModel: plainTextSchema.optional(),
	}),
	z.object({ entryMode: z.literal('photo'), aiModel: plainTextSchema.optional() }),
]);
export type Provenance = z.infer<typeof provenanceSchema>;
