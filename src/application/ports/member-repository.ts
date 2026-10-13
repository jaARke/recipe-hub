import 'server-only';
import type { Member, MemberId, MemberRole } from '@/domain/member/member';

// An account made outside the invite flow: the owner's or the seed's sample contributor.
export type NewMember = {
	email: string;
	displayName: string;
	role: MemberRole;
};

// What ensureAdmin did to the account at the address.
export type EnsuredAdmin = {
	member: Member;
	outcome: 'created' | 'promoted' | 'unchanged';
};

// Removed members keep their accounts, so the finds return them; everything else leaves them out.
export interface MemberRepository {
	findById(id: MemberId): Promise<Member | null>;
	// A removed member is found only at removedMemberEmail's address.
	findByEmail(email: string): Promise<Member | null>;
	// Oldest first.
	list(): Promise<Member[]>;
	listAdmins(): Promise<Member[]>;
	// Stores the email as verified. Invited members are created by Better Auth when they sign up.
	create(member: NewMember): Promise<Member>;
	// Makes the account at the address an admin, creating it with the email stored as verified when
	// no member has the address. Concurrent calls take turns, so they agree on one account.
	ensureAdmin(account: Omit<NewMember, 'role'>): Promise<EnsuredAdmin>;
	// Returns null when no member has this id. Throws MemberRoleConflictError when the member already
	// has the role, as when another admin changed it first.
	setRole(id: MemberId, role: MemberRole): Promise<Member | null>;
	// Marks the member removed and, in the same write, ends their sessions and deletes their passkeys
	// and any sign-in code they were sent. Their account takes removedMemberEmail's address, freeing
	// theirs for a new invite, and the open invites bound to their address are revoked. Returns null
	// when no member has this id.
	remove(id: MemberId): Promise<Member | null>;
	// Returns null when no member has this id.
	rename(id: MemberId, displayName: string): Promise<Member | null>;
}
