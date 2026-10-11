import 'server-only';
import type { MemberId, MemberRole } from '@/domain/member/member';

// Who is calling: a signed-out visitor, or a member (accounts exist only for approved members).
export type Actor =
	{ kind: 'anonymous' } | { kind: 'member'; memberId: MemberId; role: MemberRole };

export type MemberActor = Extract<Actor, { kind: 'member' }>;

export interface ActorProvider {
	// Reads the request's session, so public use cases never call it and stay cacheable.
	currentActor(): Promise<Actor>;
}
