import 'server-only';
import type {
	AccessRequest,
	AccessRequestFields,
	AccessRequestId,
} from '@/domain/member/access-request';

export interface AccessRequestRepository {
	create(fields: AccessRequestFields): Promise<AccessRequest>;
	findById(id: AccessRequestId): Promise<AccessRequest | null>;
	// Oldest first, so the longest wait is reviewed first.
	listPending(): Promise<AccessRequest[]>;
	// Returns null when no pending request has this id.
	markApproved(id: AccessRequestId): Promise<AccessRequest | null>;
	// Returns false when no pending request has this id.
	deletePending(id: AccessRequestId): Promise<boolean>;
}
