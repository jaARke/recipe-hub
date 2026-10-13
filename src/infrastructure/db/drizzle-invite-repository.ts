import 'server-only';
import { and, desc, eq, gt, isNull, notExists, type SQL } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type { InviteRepository, NewInvite } from '@/application/ports/invite-repository';
import type { Invite, InviteId } from '@/domain/member/invite';
import { inviteColumns, toInvite } from '@/infrastructure/db/invite-mapper';
import { invites, users } from '@/infrastructure/db/schema';

// Ends with the id, so invites issued at the same moment keep one order.
const newestFirst = [desc(invites.createdAt), desc(invites.id)];

export class DrizzleInviteRepository implements InviteRepository {
	private readonly db: PgDatabase<PgQueryResultHKT>;

	constructor(db: PgDatabase<PgQueryResultHKT>) {
		this.db = db;
	}

	async create(invite: NewInvite): Promise<Invite> {
		const [row] = await this.db.insert(invites).values(invite).returning(inviteColumns);
		return toInvite(row!, null);
	}

	async findByTokenHash(tokenHash: string): Promise<Invite | null> {
		const [row] = await this.selectInvites().where(eq(invites.tokenHash, tokenHash));
		return row === undefined ? null : toInvite(row.invite, row.acceptedBy);
	}

	async findOpenByEmail(email: string, now: Date): Promise<Invite | null> {
		const [row] = await this.selectInvites()
			.where(and(eq(invites.email, email), this.isOpen(now)))
			.orderBy(...newestFirst)
			.limit(1);
		return row === undefined ? null : toInvite(row.invite, row.acceptedBy);
	}

	async listOpen(now: Date): Promise<Invite[]> {
		const rows = await this.selectInvites()
			.where(this.isOpen(now))
			.orderBy(...newestFirst);
		return rows.map((row) => toInvite(row.invite, row.acceptedBy));
	}

	// An open invite has created no account, so the returned invite has no acceptedBy.
	async bindEmail(id: InviteId, email: string, now: Date): Promise<Invite | null> {
		const [row] = await this.db
			.update(invites)
			.set({ email })
			.where(and(eq(invites.id, id), this.isOpen(now)))
			.returning(inviteColumns);
		return row === undefined ? null : toInvite(row, null);
	}

	async revoke(id: InviteId, now: Date): Promise<boolean> {
		const rows = await this.db
			.update(invites)
			.set({ revokedAt: now })
			.where(and(eq(invites.id, id), this.isOpen(now)))
			.returning({ id: invites.id });
		return rows.length > 0;
	}

	// Not on the port: only a member's removal revokes this way, inside its own transaction. Migration
	// 0008_free-removed-member-emails.sql revokes the same way for members removed before it.
	async revokeOpenByEmail(email: string, now: Date): Promise<void> {
		await this.db
			.update(invites)
			.set({ revokedAt: now })
			.where(and(eq(invites.email, email), this.isOpen(now)));
	}

	// Each invite with the account it created, if any.
	private selectInvites() {
		return this.db
			.select({ invite: inviteColumns, acceptedBy: users.id })
			.from(invites)
			.leftJoin(users, eq(users.inviteId, invites.id));
	}

	// No account has used it, it is not revoked, and it expires after now.
	private isOpen(now: Date): SQL | undefined {
		return and(
			notExists(this.db.select({ id: users.id }).from(users).where(eq(users.inviteId, invites.id))),
			isNull(invites.revokedAt),
			gt(invites.expiresAt, now)
		);
	}
}
