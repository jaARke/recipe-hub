import 'server-only';
import {
	toInviteDto,
	toInvitePreviewDto,
	type InviteDto,
	type InvitePreviewDto,
	type IssuedInviteDto,
} from '@/application/access/access-dtos';
import {
	AccessRequestNotFoundError,
	InviteNotFoundError,
	InviteUnavailableError,
} from '@/application/access/errors';
import {
	createInviteToken,
	hashInviteToken,
	isInviteToken,
} from '@/application/access/invite-token';
import { requireAdmin } from '@/application/authorization';
import { MemberNotFoundError } from '@/application/members/errors';
import type { AccessRequestRepository } from '@/application/ports/access-request-repository';
import type { ActorProvider } from '@/application/ports/actor-provider';
import {
	EmailDeliveryError,
	type EmailMessage,
	type EmailSender,
} from '@/application/ports/email-sender';
import type { InviteRepository } from '@/application/ports/invite-repository';
import type { MemberRepository } from '@/application/ports/member-repository';
import { accessRequestIdSchema, type AccessRequestId } from '@/domain/member/access-request';
import {
	inviteExpiry,
	inviteIdSchema,
	inviteStatus,
	parseInviteEmail,
	parseInviteFields,
	type Invite,
} from '@/domain/member/invite';
import type { Member } from '@/domain/member/member';
import { formatDate } from '@/lib/dates';
import { getLogger } from '@/lib/logger';

const logger = getLogger('access');

export type IssueInviteInput = {
	displayName: string;
	// Where to email the link; omitted when the admin will copy it.
	sendTo?: string;
	// The pending request the invite answers; omitted when the admin invites someone directly.
	requestId?: string;
};

// The token travels in the fragment, which browsers never send to a server.
function inviteLink(appUrl: URL, token: string): string {
	const link = new URL('/invite', appUrl);
	link.hash = token;
	return link.href;
}

function inviteEmail(invite: Invite, inviter: Member, to: string, link: string): EmailMessage {
	return {
		to,
		subject: `${inviter.displayName} invited you to Recipe Hub`,
		text: [
			`Hi ${invite.displayName},`,
			`${inviter.displayName} invited you to Recipe Hub, where you can add recipes to the shared collection.`,
			`Open this link to create your account:\n${link}`,
			`The link works once and expires on ${formatDate(invite.expiresAt)}. To reach ${inviter.displayName}, reply to this email.`,
		].join('\n\n'),
		replyTo: inviter.email,
		idempotencyKey: `invite/${invite.id}`,
	};
}

export class InviteService {
	private readonly invites: InviteRepository;
	private readonly requests: AccessRequestRepository;
	private readonly members: MemberRepository;
	private readonly emails: EmailSender;
	private readonly actors: ActorProvider;
	private readonly appUrl: URL;

	constructor(
		invites: InviteRepository,
		requests: AccessRequestRepository,
		members: MemberRepository,
		emails: EmailSender,
		actors: ActorProvider,
		appUrl: URL
	) {
		this.invites = invites;
		this.requests = requests;
		this.members = members;
		this.emails = emails;
		this.actors = actors;
		this.appUrl = appUrl;
	}

	// The link is returned once; only its token's hash is stored.
	async issueInvite(input: IssueInviteInput): Promise<IssuedInviteDto> {
		const actor = requireAdmin(await this.actors.currentActor());
		const fields = parseInviteFields(input);
		const requestId =
			input.requestId === undefined ? undefined : await this.approveRequest(input.requestId);

		const token = createInviteToken();
		const invite = await this.invites.create({
			tokenHash: await hashInviteToken(token),
			requestId,
			displayName: fields.displayName,
			role: 'member',
			createdBy: actor.memberId,
			expiresAt: inviteExpiry(new Date()),
		});
		const link = inviteLink(this.appUrl, token);
		const emailed =
			fields.sendTo !== undefined && (await this.sendInvite(invite, fields.sendTo, link));

		logger.info('Invite issued', {
			inviteId: invite.id,
			requestId: invite.requestId,
			memberId: actor.memberId,
			emailed,
		});
		return { id: invite.id, link, emailed };
	}

	// Newest first.
	async listOpenInvites(): Promise<InviteDto[]> {
		requireAdmin(await this.actors.currentActor());

		const invites = await this.invites.listOpen(new Date());
		return invites.map(toInviteDto);
	}

	async revokeInvite(id: string): Promise<void> {
		const actor = requireAdmin(await this.actors.currentActor());
		// Ids arrive from forms, so a malformed id names no invite.
		const parsed = inviteIdSchema.safeParse(id);
		if (!parsed.success || !(await this.invites.revoke(parsed.data, new Date()))) {
			throw new InviteNotFoundError();
		}

		logger.info('Invite revoked', { inviteId: parsed.data, memberId: actor.memberId });
	}

	// Open to anyone holding the link; null when the link cannot be used.
	async getInvitePreview(token: string): Promise<InvitePreviewDto | null> {
		const invite = await this.findOpenInvite(token, new Date());
		return invite === null ? null : toInvitePreviewDto(invite);
	}

	// Open to anyone holding the link. Returns the address as stored, so the caller requests its code.
	async bindInviteEmail(token: string, email: string): Promise<string> {
		const now = new Date();
		const invite = await this.findOpenInvite(token, now);
		if (invite === null) {
			throw new InviteUnavailableError();
		}
		const address = parseInviteEmail(email);

		const bound = await this.invites.bindEmail(invite.id, address, now);
		if (bound === null) {
			throw new InviteUnavailableError();
		}

		return address;
	}

	// Approving before creating the invite means a request yields at most one invite.
	private async approveRequest(id: string): Promise<AccessRequestId> {
		const parsed = accessRequestIdSchema.safeParse(id);
		const request = parsed.success ? await this.requests.markApproved(parsed.data) : null;
		if (request === null) {
			throw new AccessRequestNotFoundError();
		}

		return request.id;
	}

	private async sendInvite(invite: Invite, to: string, link: string): Promise<boolean> {
		const inviter = await this.members.findById(invite.createdBy);
		if (inviter === null) {
			throw new MemberNotFoundError();
		}

		try {
			await this.emails.send(inviteEmail(invite, inviter, to, link));
			return true;
		} catch (error) {
			if (!(error instanceof EmailDeliveryError)) {
				throw error;
			}
			logger.warn('Invite email failed', { inviteId: invite.id, err: error });
			return false;
		}
	}

	private async findOpenInvite(token: string, now: Date): Promise<Invite | null> {
		if (!isInviteToken(token)) {
			return null;
		}

		const invite = await this.invites.findByTokenHash(await hashInviteToken(token));
		return invite !== null && inviteStatus(invite, now) === 'open' ? invite : null;
	}
}
