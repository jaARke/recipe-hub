import { z } from 'zod';
import { InvalidProfileError } from '@/domain/member/errors';
import { problemsFromZodError } from '@/domain/problem';
import { nonEmptyTextSchema } from '@/domain/text';

export const memberIdSchema = z.uuid().brand<'MemberId'>();
export type MemberId = z.infer<typeof memberIdSchema>;

export const memberRoleSchema = z.enum(['member', 'admin']);
export type MemberRole = z.infer<typeof memberRoleSchema>;

// Public: shown beside the recipes a member adds.
export const displayNameSchema = nonEmptyTextSchema.max(60, 'Use 60 characters or fewer.');

// Lowercased, as Better Auth stores and compares addresses.
export const emailAddressSchema = z
	.string()
	.trim()
	.toLowerCase()
	.pipe(z.email('Enter an email address, like name@example.com.'));

// How long an emailed sign-in code works; Better Auth enforces it and the email states it.
export const signInCodeLifetimeMinutes = 10;

// How long a session lasts without a visit; each day's first visit renews it.
export const sessionLifetimeDays = 180;

// The account page's form, where a member changes their name.
const profileFieldsSchema = z.object({ displayName: displayNameSchema });

// An account. Every member's email is verified: accounts are created by confirming a code.
export const memberSchema = z.object({
	id: memberIdSchema,
	displayName: displayNameSchema,
	email: emailAddressSchema,
	role: memberRoleSchema,
	createdAt: z.date(),
	// Set when an admin removed the member, who can no longer sign in. Their recipes still name them.
	removedAt: z.date().optional(),
});
export type Member = z.infer<typeof memberSchema>;

// Problems carry the form field's path, displayName.
export function parseDisplayName(input: unknown): string {
	const result = profileFieldsSchema.safeParse({ displayName: input });
	if (!result.success) {
		throw new InvalidProfileError(problemsFromZodError(result.error));
	}
	return result.data.displayName;
}
