import 'server-only';
import { requireAdmin, requireMember } from '@/application/authorization';
import {
	LastAdminError,
	MemberNotFoundError,
	SelfRemovalError,
} from '@/application/members/errors';
import {
	toCurrentMemberDto,
	toMemberDto,
	type CurrentMemberDto,
	type MemberDto,
	type MemberRef,
} from '@/application/members/member-dtos';
import type { ActorProvider } from '@/application/ports/actor-provider';
import type { MemberRepository } from '@/application/ports/member-repository';
import {
	emailAddressSchema,
	memberIdSchema,
	parseDisplayName,
	type Member,
	type MemberId,
} from '@/domain/member/member';
import { getLogger } from '@/lib/logger';

// The bootstrapped admin's name until they change it.
const bootstrappedAdminName = 'Admin';

const logger = getLogger('members');

// Ids arrive from forms, so a malformed id names no member.
function parseMemberId(id: string): MemberId {
	const parsed = memberIdSchema.safeParse(id);
	if (!parsed.success) {
		throw new MemberNotFoundError();
	}

	return parsed.data;
}

export class MemberService {
	private readonly members: MemberRepository;
	private readonly actors: ActorProvider;

	constructor(members: MemberRepository, actors: ActorProvider) {
		this.members = members;
		this.actors = actors;
	}

	// Open to anyone: null for a signed-out visitor.
	async getCurrentMember(): Promise<CurrentMemberDto | null> {
		const actor = await this.actors.currentActor();
		if (actor.kind === 'anonymous') {
			return null;
		}

		const member = await this.members.findById(actor.memberId);
		return member === null ? null : toCurrentMemberDto(member);
	}

	// Oldest first.
	async listMembers(): Promise<MemberDto[]> {
		const actor = requireAdmin(await this.actors.currentActor());

		const members = await this.members.list();
		return members.map((member) => toMemberDto(member, member.id === actor.memberId));
	}

	async renameCurrentMember(displayName: string): Promise<MemberRef> {
		const actor = requireMember(await this.actors.currentActor());
		const name = parseDisplayName(displayName);

		const member = await this.members.rename(actor.memberId, name);
		if (member === null) {
			throw new MemberNotFoundError();
		}

		logger.info('Member renamed', { memberId: member.id });
		return { id: member.id };
	}

	async makeAdmin(memberId: string): Promise<void> {
		const actor = requireAdmin(await this.actors.currentActor());
		const id = parseMemberId(memberId);

		const member = await this.members.setRole(id, 'admin');
		if (member === null) {
			throw new MemberNotFoundError();
		}

		logger.info('Admin role granted', { memberId: actor.memberId, targetMemberId: member.id });
	}

	// Admins may remove their own role too, while another admin remains.
	async removeAdmin(memberId: string): Promise<void> {
		const actor = requireAdmin(await this.actors.currentActor());
		const id = parseMemberId(memberId);

		// The repository counts the admins under the role lock.
		let member: Member | null;
		try {
			member = await this.members.setRole(id, 'member');
		} catch (error) {
			throw error instanceof LastAdminError
				? this.adminRemovalRefused(error, id, actor.memberId)
				: error;
		}
		if (member === null) {
			throw new MemberNotFoundError();
		}

		logger.info('Admin role removed', { memberId: actor.memberId, targetMemberId: member.id });
	}

	// Signs the member out everywhere and keeps them from signing in again. Their recipes stay, still
	// naming them. Admins may remove another admin, never themselves.
	async removeMember(memberId: string): Promise<void> {
		const actor = requireAdmin(await this.actors.currentActor());
		const id = parseMemberId(memberId);
		if (id === actor.memberId) {
			throw this.memberRemovalRefused(new SelfRemovalError(), id, actor.memberId);
		}

		// The repository counts the admins under the role lock.
		let member: Member | null;
		try {
			member = await this.members.remove(id);
		} catch (error) {
			throw error instanceof LastAdminError
				? this.memberRemovalRefused(error, id, actor.memberId)
				: error;
		}
		if (member === null) {
			throw new MemberNotFoundError();
		}

		logger.info('Member removed', { memberId: actor.memberId, targetMemberId: member.id });
	}

	// A system use case for the bootstrap script, with no actor: makes the account at this
	// configured address an admin, creating it if needed, unless an admin already exists.
	async ensureAdmin(email: string): Promise<void> {
		const address = emailAddressSchema.parse(email);
		if ((await this.members.listAdmins()).length > 0) {
			return;
		}

		const existing = await this.members.findByEmail(address);
		const admin =
			existing === null
				? await this.members.create({
						email: address,
						displayName: bootstrappedAdminName,
						role: 'admin',
					})
				: await this.members.setRole(existing.id, 'admin');
		if (admin === null) {
			throw new MemberNotFoundError();
		}

		logger.info('Admin bootstrapped', { memberId: admin.id, created: existing === null });
	}

	// Logged, since the admin has to make someone else an admin first.
	private adminRemovalRefused(
		error: LastAdminError,
		targetMemberId: MemberId,
		memberId: MemberId
	): LastAdminError {
		logger.warn('Admin role removal refused', { memberId, targetMemberId, failure: error.code });
		return error;
	}

	// Logged, since only a crafted request names the admin's own account, and the last admin is
	// refused only when the acting admin lost their role meanwhile.
	private memberRemovalRefused(
		error: SelfRemovalError | LastAdminError,
		targetMemberId: MemberId,
		memberId: MemberId
	): SelfRemovalError | LastAdminError {
		logger.warn('Member removal refused', { memberId, targetMemberId, failure: error.code });
		return error;
	}
}
