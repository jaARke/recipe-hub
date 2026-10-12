import 'server-only';
import type { InferModelFromColumns } from 'drizzle-orm';
import { inviteSchema, type Invite } from '@/domain/member/invite';
import { withoutNulls } from '@/infrastructure/db/nullable-columns';
import { invites } from '@/infrastructure/db/schema';

// The invite's own columns. Its acceptance lives on the account that points at it.
export const inviteColumns = {
	id: invites.id,
	requestId: invites.requestId,
	displayName: invites.displayName,
	role: invites.role,
	email: invites.email,
	createdBy: invites.createdBy,
	createdAt: invites.createdAt,
	expiresAt: invites.expiresAt,
	revokedAt: invites.revokedAt,
};

type InviteRow = InferModelFromColumns<typeof inviteColumns>;

// acceptedBy is the id of the account whose invite_id points at the invite. Invalid rows throw.
export function toInvite(row: InviteRow, acceptedBy: string | null): Invite {
	return inviteSchema.parse(withoutNulls({ ...row, acceptedBy }));
}
