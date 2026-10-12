import type { AccessRequestRepository } from '@/application/ports/access-request-repository';
import {
	accessRequestIdSchema,
	type AccessRequest,
	type AccessRequestFields,
	type AccessRequestId,
} from '@/domain/member/access-request';

export class InMemoryAccessRequestRepository implements AccessRequestRepository {
	// Insertion order is creation order, so listing needs no sort.
	private readonly requests = new Map<AccessRequestId, AccessRequest>();

	async create(fields: AccessRequestFields): Promise<AccessRequest> {
		const created: AccessRequest = {
			...fields,
			id: accessRequestIdSchema.parse(crypto.randomUUID()),
			status: 'pending',
			createdAt: new Date(),
		};
		this.requests.set(created.id, created);
		return created;
	}

	async findById(id: AccessRequestId): Promise<AccessRequest | null> {
		return this.requests.get(id) ?? null;
	}

	async listPending(): Promise<AccessRequest[]> {
		return [...this.requests.values()].filter((request) => request.status === 'pending');
	}

	async markApproved(id: AccessRequestId): Promise<AccessRequest | null> {
		const existing = this.requests.get(id);
		if (existing?.status !== 'pending') {
			return null;
		}

		const approved: AccessRequest = { ...existing, status: 'approved' };
		this.requests.set(id, approved);
		return approved;
	}

	async deletePending(id: AccessRequestId): Promise<boolean> {
		return this.requests.get(id)?.status === 'pending' && this.requests.delete(id);
	}
}
