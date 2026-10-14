import { z } from 'zod';
import { InvalidAccessRequestError } from '@/domain/member/errors';
import { displayNameSchema, emailAddressSchema } from '@/domain/member/member';
import { problemsFromZodError } from '@/domain/problem';
import { boundedTextSchema } from '@/domain/text';

export const accessRequestIdSchema = z.uuid().brand<'AccessRequestId'>();
export type AccessRequestId = z.infer<typeof accessRequestIdSchema>;

// What the public request form collects. A request creates no account.
export const accessRequestFieldsSchema = z.object({
	name: displayNameSchema,
	// How the person knows the site's members, so the admin can tell who is asking.
	relationship: boundedTextSchema(500),
	// Where to send the invite if the request is approved.
	email: emailAddressSchema.optional(),
});
export type AccessRequestFields = z.infer<typeof accessRequestFieldsSchema>;

// Declined requests are deleted, so a stored request is pending or approved.
export const accessRequestStatuses = ['pending', 'approved'] as const;

export const accessRequestSchema = accessRequestFieldsSchema.extend({
	id: accessRequestIdSchema,
	status: z.enum(accessRequestStatuses),
	createdAt: z.date(),
});
export type AccessRequest = z.infer<typeof accessRequestSchema>;

export function parseAccessRequestFields(input: unknown): AccessRequestFields {
	const result = accessRequestFieldsSchema.safeParse(input);
	if (!result.success) {
		throw new InvalidAccessRequestError(problemsFromZodError(result.error));
	}
	return result.data;
}
