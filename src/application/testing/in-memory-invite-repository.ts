import type { InviteRepository, NewInvite } from '@/application/ports/invite-repository';
import { inviteIdSchema, inviteStatus, type Invite, type InviteId } from '@/domain/member/invite';
import type { MemberId } from '@/domain/member/member';

type StoredInvite = {
	invite: Invite;
	tokenHash: string;
};

export class InMemoryInviteRepository implements InviteRepository {
	private readonly invites = new Map<InviteId, StoredInvite>();

	async create(invite: NewInvite): Promise<Invite> {
		const { tokenHash, ...fields } = invite;
		const created: Invite = {
			...fields,
			id: inviteIdSchema.parse(crypto.randomUUID()),
			createdAt: new Date(),
		};
		this.invites.set(created.id, { invite: created, tokenHash });
		return created;
	}

	async findByTokenHash(tokenHash: string): Promise<Invite | null> {
		return (
			[...this.invites.values()].find((stored) => stored.tokenHash === tokenHash)?.invite ?? null
		);
	}

	async findOpenByEmail(email: string, now: Date): Promise<Invite | null> {
		return (await this.listOpen(now)).find((invite) => invite.email === email) ?? null;
	}

	async listOpen(now: Date): Promise<Invite[]> {
		// Reversed first, so the stable sort lists invites created in the same millisecond newest first.
		return [...this.invites.values()]
			.map(({ invite }) => invite)
			.filter((invite) => inviteStatus(invite, now) === 'open')
			.reverse()
			.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
	}

	async bindEmail(id: InviteId, email: string, now: Date): Promise<Invite | null> {
		return this.replaceOpen(id, now, { email });
	}

	async revoke(id: InviteId, now: Date): Promise<boolean> {
		return this.replaceOpen(id, now, { revokedAt: now }) !== null;
	}

	async deleteUnusedClosedBefore(cutoff: Date): Promise<number> {
		let deleted = 0;
		for (const { invite } of this.invites.values()) {
			const closedBefore =
				(invite.revokedAt !== undefined && invite.revokedAt < cutoff) || invite.expiresAt < cutoff;
			if (invite.acceptedBy === undefined && closedBefore) {
				this.invites.delete(invite.id);
				deleted += 1;
			}
		}
		return deleted;
	}

	// Stands in for DrizzleInviteRepository's, which a member's removal calls. It does not await, so
	// the removal stays one uninterrupted step.
	revokeOpenByEmail(email: string, now: Date): void {
		for (const { invite } of this.invites.values()) {
			if (invite.email === email) {
				this.replaceOpen(invite.id, now, { revokedAt: now });
			}
		}
	}

	// Stands in for Better Auth, which accepts an invite by creating the account that points at it.
	accept(id: InviteId, memberId: MemberId): void {
		const stored = this.invites.get(id);
		if (stored === undefined) {
			throw new Error('No invite has this id');
		}

		this.invites.set(id, { ...stored, invite: { ...stored.invite, acceptedBy: memberId } });
	}

	private replaceOpen(id: InviteId, now: Date, changes: Partial<Invite>): Invite | null {
		const stored = this.invites.get(id);
		if (stored === undefined || inviteStatus(stored.invite, now) !== 'open') {
			return null;
		}

		const updated = { ...stored.invite, ...changes };
		this.invites.set(id, { ...stored, invite: updated });
		return updated;
	}
}
