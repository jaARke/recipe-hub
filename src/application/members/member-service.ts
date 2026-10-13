import 'server-only';
import { requireAdmin, requireMember } from '@/application/authorization';
import {
	MemberNotFoundError,
	OwnerProtectedError,
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
	type MemberId,
} from '@/domain/member/member';
import { getLogger } from '@/lib/logger';

// The owner's name when the bootstrap creates their account, until they change it.
const createdOwnerName = 'Admin';

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
	private readonly ownerEmail: string;

	// The owner is the account at ownerEmail: it keeps its admin role and is never removed, so the site
	// always has an admin. Configuring another address moves the protection to that account.
	constructor(members: MemberRepository, actors: ActorProvider, ownerEmail: string) {
		this.members = members;
		this.actors = actors;
		this.ownerEmail = emailAddressSchema.parse(ownerEmail);
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
		return members.map((member) =>
			toMemberDto(member, {
				isCurrentMember: member.id === actor.memberId,
				isOwner: member.email === this.ownerEmail,
			})
		);
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

	// Admins may remove their own role too; the owner stays an admin.
	async removeAdmin(memberId: string): Promise<void> {
		const actor = requireAdmin(await this.actors.currentActor());
		const id = parseMemberId(memberId);
		if (await this.isOwner(id)) {
			throw this.adminRemovalRefused(new OwnerProtectedError(), id, actor.memberId);
		}

		const member = await this.members.setRole(id, 'member');
		if (member === null) {
			throw new MemberNotFoundError();
		}

		logger.info('Admin role removed', { memberId: actor.memberId, targetMemberId: member.id });
	}

	// Signs the member out everywhere and keeps them from signing in again. Their recipes stay, still
	// naming them. Admins may remove another admin, never themselves or the owner.
	async removeMember(memberId: string): Promise<void> {
		const actor = requireAdmin(await this.actors.currentActor());
		const id = parseMemberId(memberId);
		if (id === actor.memberId) {
			throw this.memberRemovalRefused(new SelfRemovalError(), id, actor.memberId);
		}
		if (await this.isOwner(id)) {
			throw this.memberRemovalRefused(new OwnerProtectedError(), id, actor.memberId);
		}

		const member = await this.members.remove(id);
		if (member === null) {
			throw new MemberNotFoundError();
		}

		logger.info('Member removed', { memberId: actor.memberId, targetMemberId: member.id });
	}

	// A system use case for the bootstrap script, with no actor: makes the owner's account an admin,
	// creating it when no member has the owner's address. Every build runs it.
	async ensureOwner(): Promise<void> {
		const { member, outcome } = await this.members.ensureAdmin({
			email: this.ownerEmail,
			displayName: createdOwnerName,
		});
		if (outcome === 'unchanged') {
			return;
		}

		logger.info('Owner bootstrapped', { memberId: member.id, created: outcome === 'created' });
	}

	private async isOwner(id: MemberId): Promise<boolean> {
		return (await this.members.findById(id))?.email === this.ownerEmail;
	}

	// Logged, since the page offers no control that removes the owner's role.
	private adminRemovalRefused(
		error: OwnerProtectedError,
		targetMemberId: MemberId,
		memberId: MemberId
	): OwnerProtectedError {
		logger.warn('Admin role removal refused', { memberId, targetMemberId, failure: error.code });
		return error;
	}

	// Logged, since the page offers no control that removes the admin's own account or the owner's.
	private memberRemovalRefused(
		error: SelfRemovalError | OwnerProtectedError,
		targetMemberId: MemberId,
		memberId: MemberId
	): SelfRemovalError | OwnerProtectedError {
		logger.warn('Member removal refused', { memberId, targetMemberId, failure: error.code });
		return error;
	}
}
