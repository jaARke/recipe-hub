import 'server-only';
import type { AccessRequest, AccessRequestId } from '@/domain/member/access-request';
import type { Invite, InviteId } from '@/domain/member/invite';
import type { MemberRole } from '@/domain/member/member';

// For admins only: it holds what the person wrote about themselves and their address.
export type AccessRequestDto = {
	id: AccessRequestId;
	name: string;
	relationship: string;
	email?: string;
	createdAt: Date;
};

// For admins only: it holds the address the invitee entered.
export type InviteDto = {
	id: InviteId;
	requestId?: AccessRequestId;
	displayName: string;
	email?: string;
	createdAt: Date;
	expiresAt: Date;
};

// Returned to the admin who issued the invite; the link is never shown again.
export type IssuedInviteDto = {
	id: InviteId;
	link: string;
	// False when an address was given but the email could not be sent, so the admin copies the link.
	emailed: boolean;
};

// What anyone holding the link sees: no address, inviter, or request.
export type InvitePreviewDto = {
	displayName: string;
	expiresAt: Date;
};

// For the auth adapter: what the account it is about to create receives from the invite.
export type SignUpGrant = {
	inviteId: InviteId;
	displayName: string;
	role: MemberRole;
};

export function toAccessRequestDto(request: AccessRequest): AccessRequestDto {
	return {
		id: request.id,
		name: request.name,
		relationship: request.relationship,
		email: request.email,
		createdAt: request.createdAt,
	};
}

export function toInviteDto(invite: Invite): InviteDto {
	return {
		id: invite.id,
		requestId: invite.requestId,
		displayName: invite.displayName,
		email: invite.email,
		createdAt: invite.createdAt,
		expiresAt: invite.expiresAt,
	};
}

export function toInvitePreviewDto(invite: Invite): InvitePreviewDto {
	return { displayName: invite.displayName, expiresAt: invite.expiresAt };
}

export function toSignUpGrant(invite: Invite): SignUpGrant {
	return { inviteId: invite.id, displayName: invite.displayName, role: invite.role };
}
