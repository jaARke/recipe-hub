import { z } from 'zod';
import { InvalidProfileError } from '@/domain/member/errors';
import { problemsFromZodError } from '@/domain/problem';
import { blankTextMessage, boundedTextSchema, nonEmptyTextSchema } from '@/domain/text';

export const memberIdSchema = z.uuid().brand<'MemberId'>();
export type MemberId = z.infer<typeof memberIdSchema>;

export const memberRoleSchema = z.enum(['member', 'admin']);
export type MemberRole = z.infer<typeof memberRoleSchema>;

// Public: shown beside the recipes a member adds. The name is what a blank one's message asks for,
// such as "your display name".
export function displayNameSchema(name: string): z.ZodString {
	return boundedTextSchema(60, nonEmptyTextSchema(name));
}

// What text that isn't an address is told, here and by the auth endpoint.
export const invalidEmailMessage = 'Enter an email address, like name@example.com.';

// Lowercased, as Better Auth stores and compares addresses.
export const emailAddressSchema = z
	.string()
	.trim()
	.toLowerCase()
	.pipe(z.email(invalidEmailMessage));

// What a blank field on the account page's forms asks for, as its message says it.
const displayNameAsked = 'your display name';
const passkeyNameAsked = 'a name for the passkey';

// What a blank field says, keyed by the field, on the forms that ask for each: the account page's,
// a passkey's rename, and the email code forms. The browser checks them before sending and says
// the same.
export const profileBlankMessages = { displayName: blankTextMessage(displayNameAsked) };
export const passkeyBlankMessages = { name: blankTextMessage(passkeyNameAsked) };
export const emailBlankMessages = { email: blankTextMessage('your email address') };

// A passkey's name, which the auth endpoint checks as it checks a display name.
export const passkeyNameSchema = displayNameSchema(passkeyNameAsked);

// The account page's form, where a member changes their name.
const profileFieldsSchema = z.object({ displayName: displayNameSchema(displayNameAsked) });

// An account. Every member's email is verified: accounts are created by confirming a code.
export const memberSchema = z.object({
	id: memberIdSchema,
	displayName: displayNameSchema(displayNameAsked),
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
