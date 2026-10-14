import type { MemberDto } from '@/application/members/member-dtos';

// The controls a member's row offers the admin reading the list.
export type MemberRowActions = {
	// Make admin for a member and Remove admin for an admin. The owner always stays an admin.
	changeRole: boolean;
	// Never on the admin's own row, since another admin removes them, nor on the owner's.
	removeMember: boolean;
};

export function memberRowActions(
	member: Pick<MemberDto, 'isCurrentMember' | 'isOwner'>
): MemberRowActions {
	return {
		changeRole: !member.isOwner,
		removeMember: !member.isOwner && !member.isCurrentMember,
	};
}
