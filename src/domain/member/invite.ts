import { z } from 'zod';
import { accessRequestIdSchema } from '@/domain/member/access-request';
import { InvalidEmailError, InvalidInviteError } from '@/domain/member/errors';
import {
	displayNameSchema,
	emailAddressSchema,
	memberIdSchema,
	memberRoleSchema,
} from '@/domain/member/member';
import { problemsFromZodError } from '@/domain/problem';

export const inviteIdSchema = z.uuid().brand<'InviteId'>();
export type InviteId = z.infer<typeof inviteIdSchema>;

export const inviteLifetimeDays = 7;

// What an admin enters to invite someone.
export const inviteFieldsSchema = z.object({
	// The new member's name.
	displayName: displayNameSchema,
	// Where to email the link; the admin can copy it instead.
	sendTo: emailAddressSchema.optional(),
});
export type InviteFields = z.infer<typeof inviteFieldsSchema>;

// The invite page's form, where the invitee enters the address their account will use.
const inviteEmailFieldsSchema = z.object({ email: emailAddressSchema });

// A single-use link to create an account. Only a hash of its token is stored.
export const inviteSchema = z.object({
	id: inviteIdSchema,
	// The approved request it answers; absent when the admin invited someone directly.
	requestId: accessRequestIdSchema.optional(),
	// The new member's name, set by the admin; the member can change it later.
	displayName: displayNameSchema,
	role: memberRoleSchema,
	// Bound when the invitee enters it; the account is created for this address once it is confirmed.
	email: emailAddressSchema.optional(),
	createdBy: memberIdSchema,
	createdAt: z.date(),
	expiresAt: z.date(),
	revokedAt: z.date().optional(),
	// The member whose account it created.
	acceptedBy: memberIdSchema.optional(),
});
export type Invite = z.infer<typeof inviteSchema>;

export const inviteStatuses = ['open', 'accepted', 'expired', 'revoked'] as const;
export type InviteStatus = (typeof inviteStatuses)[number];

export function inviteStatus(invite: Invite, now: Date): InviteStatus {
	if (invite.acceptedBy !== undefined) {
		return 'accepted';
	}
	if (invite.revokedAt !== undefined) {
		return 'revoked';
	}
	return invite.expiresAt <= now ? 'expired' : 'open';
}

export function inviteExpiry(createdAt: Date): Date {
	return new Date(createdAt.getTime() + inviteLifetimeDays * 24 * 60 * 60 * 1000);
}

export function parseInviteFields(input: unknown): InviteFields {
	const result = inviteFieldsSchema.safeParse(input);
	if (!result.success) {
		throw new InvalidInviteError(problemsFromZodError(result.error));
	}
	return result.data;
}

// Problems carry the form field's path, email.
export function parseInviteEmail(input: unknown): string {
	const result = inviteEmailFieldsSchema.safeParse({ email: input });
	if (!result.success) {
		throw new InvalidEmailError(problemsFromZodError(result.error));
	}
	return result.data.email;
}
