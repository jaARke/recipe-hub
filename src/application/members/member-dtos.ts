import 'server-only';
import type { Member, MemberId, MemberRole } from '@/domain/member/member';

// The only member shape public pages show: no email or role.
export type PublicMemberDto = {
	id: MemberId;
	displayName: string;
};

// The signed-in member's own view, for the header and the account page.
export type CurrentMemberDto = PublicMemberDto & {
	email: string;
	role: MemberRole;
};

// For admins only: every member's email and role, which member is the admin reading them, and which
// is the owner, who cannot be removed or lose admin.
export type MemberDto = CurrentMemberDto & {
	createdAt: Date;
	isCurrentMember: boolean;
	isOwner: boolean;
};

// Returned by writes, so callers can invalidate the member's cache tag.
export type MemberRef = {
	id: MemberId;
};

export function toPublicMemberDto(member: Member): PublicMemberDto {
	return { id: member.id, displayName: member.displayName };
}

export function toCurrentMemberDto(member: Member): CurrentMemberDto {
	return { ...toPublicMemberDto(member), email: member.email, role: member.role };
}

export function toMemberDto(
	member: Member,
	standing: Pick<MemberDto, 'isCurrentMember' | 'isOwner'>
): MemberDto {
	return { ...toCurrentMemberDto(member), createdAt: member.createdAt, ...standing };
}
