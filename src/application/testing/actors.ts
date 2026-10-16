import type { Actor, MemberActor } from '@/application/ports/actor-provider';
import { memberIdSchema, type Member, type MemberRole } from '@/domain/member/member';

// Signed in now.
function newMemberActor(role: MemberRole): MemberActor {
	return {
		kind: 'member',
		memberId: memberIdSchema.parse(crypto.randomUUID()),
		role,
		sessionStartedAt: new Date(),
	};
}

export function anonymousActor(): Actor {
	return { kind: 'anonymous' };
}

// Each call is a different member.
export function memberActor(): MemberActor {
	return newMemberActor('member');
}

export function adminActor(): MemberActor {
	return newMemberActor('admin');
}

// Signed in now as a stored member, for use cases that read the member's own record.
export function actorFor(member: Member): MemberActor {
	return { kind: 'member', memberId: member.id, role: member.role, sessionStartedAt: new Date() };
}
