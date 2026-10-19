import 'server-only';
import { requireAdmin, requireMember } from '@/application/authorization';
import {
	MemberNotFoundError,
	OwnerOnlyError,
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
	type Member,
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
	// always has an admin, and only it takes away another admin's role or account. Configuring another
	// address moves ownership to that account.
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

	// The owner removes another admin's role, and an admin may remove their own; the owner stays an
	// admin.
	async removeAdmin(memberId: string): Promise<void> {
		const actor = requireAdmin(await this.actors.currentActor());
		const id = parseMemberId(memberId);
		if (await this.isOwner(id)) {
			throw this.adminRemovalRefused(new OwnerProtectedError(), id, actor.memberId);
		}
		if (id !== actor.memberId && !(await this.isOwner(actor.memberId))) {
			throw this.adminRemovalRefused(new OwnerOnlyError(), id, actor.memberId);
		}

		const member = await this.members.setRole(id, 'member');
		if (member === null) {
			throw new MemberNotFoundError();
		}

		logger.info('Admin role removed', { memberId: actor.memberId, targetMemberId: member.id });
	}

	// Signs the member out everywhere and keeps them from signing in again. Their recipes stay, still
	// naming them. Admins may remove a member, and only the owner another admin; no one removes
	// themselves or the owner.
	async removeMember(memberId: string): Promise<void> {
		const actor = requireAdmin(await this.actors.currentActor());
		const id = parseMemberId(memberId);
		if (id === actor.memberId) {
			throw this.memberRemovalRefused(new SelfRemovalError(), id, actor.memberId);
		}
		const target = await this.members.findById(id);
		if (this.isOwnerAccount(target)) {
			throw this.memberRemovalRefused(new OwnerProtectedError(), id, actor.memberId);
		}
		const byOwner = await this.isOwner(actor.memberId);
		if (target?.removedAt === undefined && target?.role === 'admin' && !byOwner) {
			throw this.memberRemovalRefused(new OwnerOnlyError(), id, actor.memberId);
		}

		// Another admin removes only a member, so their removal holds only while the role does, even if
		// the owner makes them an admin meanwhile.
		const member = await this.members.remove(id, byOwner ? undefined : 'member');
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

	private isOwnerAccount(member: Member | null): boolean {
		return member?.email === this.ownerEmail;
	}

	private async isOwner(id: MemberId): Promise<boolean> {
		return this.isOwnerAccount(await this.members.findById(id));
	}

	// Logged, since the page offers no control the service refuses.
	private adminRemovalRefused<E extends OwnerProtectedError | OwnerOnlyError>(
		error: E,
		targetMemberId: MemberId,
		memberId: MemberId
	): E {
		logger.warn('Admin role removal refused', { memberId, targetMemberId, failure: error.code });
		return error;
	}

	// Logged, since the page offers no control the service refuses.
	private memberRemovalRefused<E extends SelfRemovalError | OwnerProtectedError | OwnerOnlyError>(
		error: E,
		targetMemberId: MemberId,
		memberId: MemberId
	): E {
		logger.warn('Member removal refused', { memberId, targetMemberId, failure: error.code });
		return error;
	}
}
