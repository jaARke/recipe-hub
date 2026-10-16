import 'server-only';
import { lt } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type { SignInRepository } from '@/application/ports/sign-in-repository';
import { sessions, verifications } from '@/infrastructure/db/schema';

export class DrizzleSignInRepository implements SignInRepository {
	private readonly db: PgDatabase<PgQueryResultHKT>;

	constructor(db: PgDatabase<PgQueryResultHKT>) {
		this.db = db;
	}

	async deleteSessionsExpiredBefore(cutoff: Date): Promise<number> {
		const rows = await this.db
			.delete(sessions)
			.where(lt(sessions.expiresAt, cutoff))
			.returning({ id: sessions.id });
		return rows.length;
	}

	async deleteVerificationsExpiredBefore(cutoff: Date): Promise<number> {
		const rows = await this.db
			.delete(verifications)
			.where(lt(verifications.expiresAt, cutoff))
			.returning({ id: verifications.id });
		return rows.length;
	}
}
