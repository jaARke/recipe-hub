import 'server-only';
import type { Member, MemberId, MemberRole } from '@/domain/member/member';

// An account made outside the invite flow: the bootstrapped admin or the seed's sample contributor.
export type NewMember = {
	email: string;
	displayName: string;
	role: MemberRole;
};

// Removed members keep their accounts, so the finds return them; everything else leaves them out.
export interface MemberRepository {
	findById(id: MemberId): Promise<Member | null>;
	findByEmail(email: string): Promise<Member | null>;
	// Oldest first.
	list(): Promise<Member[]>;
	listAdmins(): Promise<Member[]>;
	// Stores the email as verified. Invited members are created by Better Auth when they sign up.
	create(member: NewMember): Promise<Member>;
	// Returns null when no member has this id. Throws MemberRoleConflictError when the member already
	// has the role, and LastAdminError rather than take admin from the only admin. Role changes and
	// removals take turns, so two admins removing each other at once leave one of them an admin.
	setRole(id: MemberId, role: MemberRole): Promise<Member | null>;
	// Marks the member removed and, in the same write, ends their sessions and deletes their passkeys
	// and any sign-in code they were sent. Returns null when no member has this id, and throws
	// LastAdminError rather than remove the only admin.
	remove(id: MemberId): Promise<Member | null>;
	// Returns null when no member has this id.
	rename(id: MemberId, displayName: string): Promise<Member | null>;
}
