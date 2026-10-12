import 'server-only';
import type { InferModelFromColumns } from 'drizzle-orm';
import { accessRequestSchema, type AccessRequest } from '@/domain/member/access-request';
import { withoutNulls } from '@/infrastructure/db/nullable-columns';
import { accessRequests } from '@/infrastructure/db/schema';

export const accessRequestColumns = {
	id: accessRequests.id,
	name: accessRequests.name,
	relationship: accessRequests.relationship,
	email: accessRequests.email,
	status: accessRequests.status,
	createdAt: accessRequests.createdAt,
};

type AccessRequestRow = InferModelFromColumns<typeof accessRequestColumns>;

// Invalid rows throw.
export function toAccessRequest(row: AccessRequestRow): AccessRequest {
	return accessRequestSchema.parse(withoutNulls(row));
}
