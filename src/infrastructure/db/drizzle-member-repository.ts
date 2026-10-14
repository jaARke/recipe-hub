import 'server-only';
import { and, asc, eq, isNull, ne, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { MemberRoleConflictError } from '@/application/members/errors';
import type {
	EnsuredAdmin,
	MemberRepository,
	NewMember,
} from '@/application/ports/member-repository';
import {
	removedMemberEmail,
	type Member,
	type MemberId,
	type MemberRole,
} from '@/domain/member/member';
import { DrizzleInviteRepository } from '@/infrastructure/db/drizzle-invite-repository';
import { memberColumns, toInsertColumns, toMember } from '@/infrastructure/db/member-mapper';
import { passkeys, sessions, users, verifications } from '@/infrastructure/db/schema';
import { lockForTransaction } from '@/infrastructure/db/transaction-lock';

// Ends with the id, so members created at the same moment keep one order.
const oldestFirst = [asc(users.createdAt), asc(users.id)];

const notRemoved = isNull(users.removedAt);

const adminNotRemoved = and(eq(users.role, 'admin'), notRemoved);

// ensureAdmin takes this transaction-scoped lock, so two builds bootstrapping one database take
// turns, and the later one finds the account the earlier one made.
const ensureAdminLockKey = 'recipe-hub:ensure-admin';

// The verification identifier of the sign-in code Better Auth's email-OTP plugin sends an address.
function signInCodeIdentifier(email: string): string {
	return `sign-in-otp-${email}`;
}

export class DrizzleMemberRepository implements MemberRepository {
	private readonly db: PgDatabase<PgQueryResultHKT>;

	constructor(db: PgDatabase<PgQueryResultHKT>) {
		this.db = db;
	}

	async findById(id: MemberId): Promise<Member | null> {
		const [row] = await this.db.select(memberColumns).from(users).where(eq(users.id, id));
		return row === undefined ? null : toMember(row);
	}

	async findByEmail(email: string): Promise<Member | null> {
		const [row] = await this.db.select(memberColumns).from(users).where(eq(users.email, email));
		return row === undefined ? null : toMember(row);
	}

	async list(): Promise<Member[]> {
		const rows = await this.db
			.select(memberColumns)
			.from(users)
			.where(notRemoved)
			.orderBy(...oldestFirst);
		return rows.map(toMember);
	}

	async listAdmins(): Promise<Member[]> {
		const rows = await this.db
			.select(memberColumns)
			.from(users)
			.where(adminNotRemoved)
			.orderBy(...oldestFirst);
		return rows.map(toMember);
	}

	async create(member: NewMember): Promise<Member> {
		const [row] = await this.db
			.insert(users)
			.values(toInsertColumns(member))
			.returning(memberColumns);
		return toMember(row!);
	}

	async ensureAdmin(account: Omit<NewMember, 'role'>): Promise<EnsuredAdmin> {
		return this.db.transaction(async (tx) => {
			await lockForTransaction(tx, ensureAdminLockKey);
			const [current] = await tx
				.select(memberColumns)
				.from(users)
				.where(and(eq(users.email, account.email), notRemoved));
			if (current === undefined) {
				const [row] = await tx
					.insert(users)
					.values(toInsertColumns({ ...account, role: 'admin' }))
					.returning(memberColumns);
				return { member: toMember(row!), outcome: 'created' };
			}
			if (current.role === 'admin') {
				return { member: toMember(current), outcome: 'unchanged' };
			}

			const [row] = await tx
				.update(users)
				.set({ role: 'admin', updatedAt: sql`now()` })
				.where(eq(users.id, current.id))
				.returning(memberColumns);
			return { member: toMember(row!), outcome: 'promoted' };
		});
	}

	// Writes only a role that differs, so of two admins making the same change at once, the later one
	// finds nothing to change and is told so.
	async setRole(id: MemberId, role: MemberRole): Promise<Member | null> {
		const [row] = await this.db
			.update(users)
			.set({ role, updatedAt: sql`now()` })
			.where(and(eq(users.id, id), notRemoved, ne(users.role, role)))
			.returning(memberColumns);
		if (row !== undefined) {
			return toMember(row);
		}

		if ((await this.db.$count(users, and(eq(users.id, id), notRemoved))) === 0) {
			return null;
		}
		throw new MemberRoleConflictError();
	}

	async remove(id: MemberId): Promise<Member | null> {
		return this.db.transaction(async (tx) => {
			const [current] = await tx
				.select({ email: users.email })
				.from(users)
				.where(and(eq(users.id, id), notRemoved));
			if (current === undefined) {
				return null;
			}

			// Marks only a member not removed yet, so of two removals at once, the later one stops here.
			const [row] = await tx
				.update(users)
				.set({
					email: removedMemberEmail(id),
					removedAt: sql`now()`,
					updatedAt: sql`now()`,
				})
				.where(and(eq(users.id, id), notRemoved))
				.returning(memberColumns);
			if (row === undefined) {
				return null;
			}

			await tx.delete(sessions).where(eq(sessions.userId, id));
			await tx.delete(passkeys).where(eq(passkeys.userId, id));
			await tx
				.delete(verifications)
				.where(eq(verifications.identifier, signInCodeIdentifier(current.email)));
			await new DrizzleInviteRepository(tx).revokeOpenByEmail(current.email, new Date());
			return toMember(row);
		});
	}

	async rename(id: MemberId, displayName: string): Promise<Member | null> {
		const [row] = await this.db
			.update(users)
			.set({ displayName, updatedAt: sql`now()` })
			.where(and(eq(users.id, id), notRemoved))
			.returning(memberColumns);
		return row === undefined ? null : toMember(row);
	}
}
