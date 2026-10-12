import 'server-only';
import { asc, eq, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type { MemberRepository, NewMember } from '@/application/ports/member-repository';
import type { Member, MemberId, MemberRole } from '@/domain/member/member';
import { memberColumns, toInsertColumns, toMember } from '@/infrastructure/db/member-mapper';
import { users } from '@/infrastructure/db/schema';

// Ends with the id, so members created at the same moment keep one order.
const oldestFirst = [asc(users.createdAt), asc(users.id)];

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
			.orderBy(...oldestFirst);
		return rows.map(toMember);
	}

	async listAdmins(): Promise<Member[]> {
		const rows = await this.db
			.select(memberColumns)
			.from(users)
			.where(eq(users.role, 'admin'))
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
		const [row] = await this.db
			.update(users)
			.set({ role, updatedAt: sql`now()` })
			.where(eq(users.id, id))
			.returning(memberColumns);
		return row === undefined ? null : toMember(row);
	}

	async rename(id: MemberId, displayName: string): Promise<Member | null> {
		const [row] = await this.db
			.update(users)
			.set({ displayName, updatedAt: sql`now()` })
			.where(eq(users.id, id))
			.returning(memberColumns);
		return row === undefined ? null : toMember(row);
	}
}
