import 'server-only';
import { and, asc, eq } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type { AccessRequestRepository } from '@/application/ports/access-request-repository';
import type {
	AccessRequest,
	AccessRequestFields,
	AccessRequestId,
} from '@/domain/member/access-request';
import { accessRequestColumns, toAccessRequest } from '@/infrastructure/db/access-request-mapper';
import { accessRequests } from '@/infrastructure/db/schema';

export class DrizzleAccessRequestRepository implements AccessRequestRepository {
	private readonly db: PgDatabase<PgQueryResultHKT>;

	constructor(db: PgDatabase<PgQueryResultHKT>) {
		this.db = db;
	}

	async create(fields: AccessRequestFields): Promise<AccessRequest> {
		const [row] = await this.db
			.insert(accessRequests)
			.values(fields)
			.returning(accessRequestColumns);
		return toAccessRequest(row!);
	}

	async findById(id: AccessRequestId): Promise<AccessRequest | null> {
		const [row] = await this.db
			.select(accessRequestColumns)
			.from(accessRequests)
			.where(eq(accessRequests.id, id));
		return row === undefined ? null : toAccessRequest(row);
	}

	async listPending(): Promise<AccessRequest[]> {
		const rows = await this.db
			.select(accessRequestColumns)
			.from(accessRequests)
			.where(eq(accessRequests.status, 'pending'))
			.orderBy(asc(accessRequests.createdAt), asc(accessRequests.id));
		return rows.map(toAccessRequest);
	}

	async markApproved(id: AccessRequestId): Promise<AccessRequest | null> {
		const [row] = await this.db
			.update(accessRequests)
			.set({ status: 'approved' })
			.where(and(eq(accessRequests.id, id), eq(accessRequests.status, 'pending')))
			.returning(accessRequestColumns);
		return row === undefined ? null : toAccessRequest(row);
	}

	async deletePending(id: AccessRequestId): Promise<boolean> {
		const rows = await this.db
			.delete(accessRequests)
			.where(and(eq(accessRequests.id, id), eq(accessRequests.status, 'pending')))
			.returning({ id: accessRequests.id });
		return rows.length > 0;
	}
}
