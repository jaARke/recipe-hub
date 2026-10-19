import type { MemberDto } from '@/application/members/member-dtos';

// The controls a member's row offers the admin reading the list.
export type MemberRowActions = {
	// Make admin for a member, and Remove admin for an admin: the owner removes another admin's role,
	// and an admin their own. The owner always stays an admin, so their row offers only Make admin, and
	// only while their account somehow isn't one.
	changeRole: boolean;
	// Any member's account but an admin's, which only the owner removes; never the reader's own, nor
	// the owner's.
	removeMember: boolean;
};

export function memberRowActions(
	member: Pick<MemberDto, 'isCurrentMember' | 'isOwner' | 'role'>,
	readerIsOwner: boolean
): MemberRowActions {
	const isAdmin = member.role === 'admin';
	if (member.isOwner) {
		return { changeRole: !isAdmin, removeMember: false };
	}
	return {
		changeRole: !isAdmin || member.isCurrentMember || readerIsOwner,
		removeMember: !member.isCurrentMember && (!isAdmin || readerIsOwner),
	};
}
