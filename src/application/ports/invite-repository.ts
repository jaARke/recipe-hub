import 'server-only';
import type { AccessRequestId } from '@/domain/member/access-request';
import type { Invite, InviteId } from '@/domain/member/invite';
import type { MemberId, MemberRole } from '@/domain/member/member';

export type NewInvite = {
	tokenHash: string;
	requestId?: AccessRequestId;
	displayName: string;
	role: MemberRole;
	createdBy: MemberId;
	expiresAt: Date;
};

// An invite is open while no account has used it, it is not revoked, and it expires after now.
export interface InviteRepository {
	create(invite: NewInvite): Promise<Invite>;
	findByTokenHash(tokenHash: string): Promise<Invite | null>;
	// The newest open invite bound to this address.
	findOpenByEmail(email: string, now: Date): Promise<Invite | null>;
	// Newest first.
	listOpen(now: Date): Promise<Invite[]>;
	// Returns null when no open invite has this id.
	bindEmail(id: InviteId, email: string, now: Date): Promise<Invite | null>;
	// Returns false when no open invite has this id.
	revoke(id: InviteId, now: Date): Promise<boolean>;
	// Deletes every invite no account used that expired or was revoked before the given time, and
	// returns how many it deleted. A used invite stays, since its account names it.
	deleteUnusedClosedBefore(cutoff: Date): Promise<number>;
}
