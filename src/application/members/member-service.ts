import 'server-only';
import { requireAdmin, requireMember } from '@/application/authorization';
import { MemberNotFoundError } from '@/application/members/errors';
import {
	toCurrentMemberDto,
	toMemberDto,
	type CurrentMemberDto,
	type MemberDto,
	type MemberRef,
} from '@/application/members/member-dtos';
import type { ActorProvider } from '@/application/ports/actor-provider';
import type { MemberRepository } from '@/application/ports/member-repository';
import { emailAddressSchema, parseDisplayName } from '@/domain/member/member';
import { getLogger } from '@/lib/logger';

// The bootstrapped admin's name until they change it.
const bootstrappedAdminName = 'Admin';

const logger = getLogger('members');

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
		requireAdmin(await this.actors.currentActor());

		const members = await this.members.list();
		return members.map(toMemberDto);
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
}
