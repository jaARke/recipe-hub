import { LastAdminError, MemberRoleConflictError } from '@/application/members/errors';
import type { MemberRepository, NewMember } from '@/application/ports/member-repository';
import {
	memberIdSchema,
	type Member,
	type MemberId,
	type MemberRole,
} from '@/domain/member/member';

export class InMemoryMemberRepository implements MemberRepository {
	// Insertion order is creation order, so listing needs no sort.
	private readonly members = new Map<MemberId, Member>();

	async findById(id: MemberId): Promise<Member | null> {
		return this.members.get(id) ?? null;
	}

	async findByEmail(email: string): Promise<Member | null> {
		return [...this.members.values()].find((member) => member.email === email) ?? null;
	}

	async list(): Promise<Member[]> {
		return [...this.members.values()];
	}

	async listAdmins(): Promise<Member[]> {
		return [...this.members.values()].filter((member) => member.role === 'admin');
	}

	async create(member: NewMember): Promise<Member> {
		if ((await this.findByEmail(member.email)) !== null) {
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

	async setRole(id: MemberId, role: MemberRole): Promise<Member | null> {
		const existing = this.members.get(id);
		if (existing === undefined) {
			return null;
		}

		if (existing.role === role) {
			throw new MemberRoleConflictError();
		}
		if (existing.role === 'admin' && (await this.listAdmins()).length === 1) {
			throw new LastAdminError();
		}

		return this.replace(id, { role });
	}

	async rename(id: MemberId, displayName: string): Promise<Member | null> {
		return this.replace(id, { displayName });
	}

	private replace(id: MemberId, changes: Partial<Member>): Member | null {
		const existing = this.members.get(id);
		if (existing === undefined) {
			return null;
		}

		const updated = { ...existing, ...changes };
		this.members.set(id, updated);
		return updated;
	}
}
