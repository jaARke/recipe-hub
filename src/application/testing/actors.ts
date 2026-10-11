import type { Actor, MemberActor } from '@/application/ports/actor-provider';
import { memberIdSchema, type MemberRole } from '@/domain/member/member';

function newMemberActor(role: MemberRole): MemberActor {
	return { kind: 'member', memberId: memberIdSchema.parse(crypto.randomUUID()), role };
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
