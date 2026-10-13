import { MemberRoleConflictError } from '@/application/members/errors';
import type {
	EnsuredAdmin,
	MemberRepository,
	NewMember,
} from '@/application/ports/member-repository';
import type { InMemoryInviteRepository } from '@/application/testing/in-memory-invite-repository';
import {
	memberIdSchema,
	removedMemberEmail,
	type Member,
	type MemberId,
	type MemberRole,
} from '@/domain/member/member';

// Each write checks and changes its member without awaiting in between, so concurrent calls take
// turns as the database's do.
export class InMemoryMemberRepository implements MemberRepository {
	// Insertion order is creation order, so listing needs no sort.
	private readonly members = new Map<MemberId, Member>();
	private readonly invites: InMemoryInviteRepository;

	// The invites a removal revokes, as the database's removal does in its transaction.
	constructor(invites: InMemoryInviteRepository) {
		this.invites = invites;
	}

	async findById(id: MemberId): Promise<Member | null> {
		return this.members.get(id) ?? null;
	}

	async findByEmail(email: string): Promise<Member | null> {
		return this.findWithEmail(email) ?? null;
	}

	async list(): Promise<Member[]> {
		return [...this.members.values()].filter((member) => member.removedAt === undefined);
	}

	async listAdmins(): Promise<Member[]> {
		return (await this.list()).filter((member) => member.role === 'admin');
	}

	async create(member: NewMember): Promise<Member> {
		return this.insert(member);
	}

	async ensureAdmin(account: Omit<NewMember, 'role'>): Promise<EnsuredAdmin> {
		const existing = this.findWithEmail(account.email);
		if (existing === undefined || existing.removedAt !== undefined) {
			return { member: this.insert({ ...account, role: 'admin' }), outcome: 'created' };
		}
		if (existing.role === 'admin') {
			return { member: existing, outcome: 'unchanged' };
		}

		return { member: this.replace(existing.id, { role: 'admin' }), outcome: 'promoted' };
	}

	async setRole(id: MemberId, role: MemberRole): Promise<Member | null> {
		const existing = this.findNotRemoved(id);
		if (existing === undefined) {
			return null;
		}

		if (existing.role === role) {
			throw new MemberRoleConflictError();
		}

		return this.replace(id, { role });
	}

	// Keeps no sessions, passkeys, or codes, so the removal frees the address and revokes its invites.
	async remove(id: MemberId): Promise<Member | null> {
		const existing = this.findNotRemoved(id);
		if (existing === undefined) {
			return null;
		}

		const now = new Date();
		this.invites.revokeOpenByEmail(existing.email, now);
		return this.replace(id, { email: removedMemberEmail(id), removedAt: now });
	}

	async rename(id: MemberId, displayName: string): Promise<Member | null> {
		return this.findNotRemoved(id) === undefined ? null : this.replace(id, { displayName });
	}

	private findWithEmail(email: string): Member | undefined {
		return [...this.members.values()].find((member) => member.email === email);
	}

	private findNotRemoved(id: MemberId): Member | undefined {
		const existing = this.members.get(id);
		return existing?.removedAt === undefined ? existing : undefined;
	}

	private insert(member: NewMember): Member {
		if (this.findWithEmail(member.email) !== undefined) {
			throw new Error('A member already has this email');
		}

		const created: Member = {
			...member,
			id: memberIdSchema.parse(crypto.randomUUID()),
			createdAt: new Date(),
		};
		this.members.set(created.id, created);
		return created;
	}

	private replace(id: MemberId, changes: Partial<Member>): Member {
		const updated = { ...this.members.get(id)!, ...changes };
		this.members.set(id, updated);
		return updated;
	}
}
