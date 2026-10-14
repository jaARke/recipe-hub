import { z } from 'zod';
import { InvalidProfileError } from '@/domain/member/errors';
import { problemsFromZodError } from '@/domain/problem';
import { boundedTextSchema } from '@/domain/text';

export const memberIdSchema = z.uuid().brand<'MemberId'>();
export type MemberId = z.infer<typeof memberIdSchema>;

export const memberRoleSchema = z.enum(['member', 'admin']);
export type MemberRole = z.infer<typeof memberRoleSchema>;

// Public: shown beside the recipes a member adds.
export const displayNameSchema = boundedTextSchema(60);

// Lowercased, as Better Auth stores and compares addresses.
export const emailAddressSchema = z
	.string()
	.trim()
	.toLowerCase()
	.pipe(z.email('Enter an email address, like name@example.com.'));

// The account page's form, where a member changes their name.
const profileFieldsSchema = z.object({ displayName: displayNameSchema });

// An account. Every member's email is verified: accounts are created by confirming a code.
export const memberSchema = z.object({
	id: memberIdSchema,
	displayName: displayNameSchema,
	email: emailAddressSchema,
	role: memberRoleSchema,
	createdAt: z.date(),
	// Set when an admin removed the member, who can no longer sign in. The account then holds
	// removedMemberEmail's address, and their recipes still name them.
	removedAt: z.date().optional(),
});
export type Member = z.infer<typeof memberSchema>;

// The address a removed member's account takes, which frees their own for a new invite and a new
// account. The .invalid domain never receives mail. Migration 0008_free-removed-member-emails.sql
// writes the same address.
export function removedMemberEmail(id: MemberId): string {
	return `removed+${id}@recipes.invalid`;
}

// Problems carry the form field's path, displayName.
export function parseDisplayName(input: unknown): string {
	const result = profileFieldsSchema.safeParse({ displayName: input });
	if (!result.success) {
		throw new InvalidProfileError(problemsFromZodError(result.error));
	}
	return result.data.displayName;
}
