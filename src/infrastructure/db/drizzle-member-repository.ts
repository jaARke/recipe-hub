import 'server-only';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { LastAdminError, MemberRoleConflictError } from '@/application/members/errors';
import type { MemberRepository, NewMember } from '@/application/ports/member-repository';
import type { Member, MemberId, MemberRole } from '@/domain/member/member';
import { memberColumns, toInsertColumns, toMember } from '@/infrastructure/db/member-mapper';
import { passkeys, sessions, users, verifications } from '@/infrastructure/db/schema';
import { lockForTransaction } from '@/infrastructure/db/transaction-lock';

// Ends with the id, so members created at the same moment keep one order.
const oldestFirst = [asc(users.createdAt), asc(users.id)];

const notRemoved = isNull(users.removedAt);

const adminNotRemoved = and(eq(users.role, 'admin'), notRemoved);

// Every role change and removal takes this transaction-scoped lock, so the admins it counts stay
// admins until it commits, and two admins removing each other take turns.
const roleLockKey = 'recipe-hub:member-roles';

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

	async setRole(id: MemberId, role: MemberRole): Promise<Member | null> {
		return this.db.transaction(async (tx) => {
			await lockForTransaction(tx, roleLockKey);
			const [current] = await tx
				.select({ role: users.role })
				.from(users)
				.where(and(eq(users.id, id), notRemoved));
			if (current === undefined) {
				return null;
			}

			if (current.role === role) {
				throw new MemberRoleConflictError();
			}
			if (current.role === 'admin' && (await tx.$count(users, adminNotRemoved)) === 1) {
				throw new LastAdminError();
			}

			const [row] = await tx
				.update(users)
				.set({ role, updatedAt: sql`now()` })
				.where(eq(users.id, id))
				.returning(memberColumns);
			return row === undefined ? null : toMember(row);
		});
	}

	async remove(id: MemberId): Promise<Member | null> {
		return this.db.transaction(async (tx) => {
			await lockForTransaction(tx, roleLockKey);
			const [current] = await tx
				.select({ role: users.role, email: users.email })
				.from(users)
				.where(and(eq(users.id, id), notRemoved));
			if (current === undefined) {
				return null;
			}

			if (current.role === 'admin' && (await tx.$count(users, adminNotRemoved)) === 1) {
				throw new LastAdminError();
			}

			const [row] = await tx
				.update(users)
				.set({ removedAt: sql`now()`, updatedAt: sql`now()` })
				.where(eq(users.id, id))
				.returning(memberColumns);
			await tx.delete(sessions).where(eq(sessions.userId, id));
			await tx.delete(passkeys).where(eq(passkeys.userId, id));
			await tx
				.delete(verifications)
				.where(eq(verifications.identifier, signInCodeIdentifier(current.email)));
			return row === undefined ? null : toMember(row);
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
