import 'server-only';
import { toAccessRequestDto, type AccessRequestDto } from '@/application/access/access-dtos';
import { AccessRequestNotFoundError } from '@/application/access/errors';
import { requireAdmin } from '@/application/authorization';
import type { AccessRequestRepository } from '@/application/ports/access-request-repository';
import type { ActorProvider } from '@/application/ports/actor-provider';
import {
	EmailDeliveryError,
	type EmailMessage,
	type EmailSender,
} from '@/application/ports/email-sender';
import type { MemberRepository } from '@/application/ports/member-repository';
import {
	accessRequestIdSchema,
	parseAccessRequestFields,
	type AccessRequest,
} from '@/domain/member/access-request';
import type { Member } from '@/domain/member/member';
import { getLogger } from '@/lib/logger';
import { siteName } from '@/lib/site';

const logger = getLogger('access');

// Names who asked and nothing more; the request itself stays on the admin page.
function accessRequestNotification(
	request: AccessRequest,
	admin: Member,
	appUrl: URL
): EmailMessage {
	return {
		to: admin.email,
		subject: 'New access request',
		text: [
			`${request.name} asked for access to ${siteName}.`,
			`Review the request on the admin page:\n${new URL('/admin', appUrl).href}`,
		].join('\n\n'),
		idempotencyKey: `access-request-notification/${request.id}/${admin.id}`,
	};
}

export class AccessRequestService {
	private readonly requests: AccessRequestRepository;
	private readonly members: MemberRepository;
	private readonly emails: EmailSender;
	private readonly actors: ActorProvider;
	private readonly appUrl: URL;

	constructor(
		requests: AccessRequestRepository,
		members: MemberRepository,
		emails: EmailSender,
		actors: ActorProvider,
		appUrl: URL
	) {
		this.requests = requests;
		this.members = members;
		this.emails = emails;
		this.actors = actors;
		this.appUrl = appUrl;
	}

	// Open to anyone. The request is kept even when no admin could be emailed.
	async submitRequest(input: unknown): Promise<void> {
		const fields = parseAccessRequestFields(input);

		const request = await this.requests.create(fields);

		logger.info('Access requested', { requestId: request.id });
		await this.notifyAdmins(request);
	}

	// Oldest first.
	async listPendingRequests(): Promise<AccessRequestDto[]> {
		requireAdmin(await this.actors.currentActor());

		const requests = await this.requests.listPending();
		return requests.map(toAccessRequestDto);
	}

	// Declining deletes the request, so nothing about the person is kept.
	async declineRequest(id: string): Promise<void> {
		const actor = requireAdmin(await this.actors.currentActor());
		// Ids arrive from forms, so a malformed id names no request.
		const parsed = accessRequestIdSchema.safeParse(id);
		if (!parsed.success || !(await this.requests.deletePending(parsed.data))) {
			throw new AccessRequestNotFoundError();
		}

		logger.info('Access request declined', { requestId: parsed.data, memberId: actor.memberId });
	}

	private async notifyAdmins(request: AccessRequest): Promise<void> {
		for (const admin of await this.members.listAdmins()) {
			try {
				await this.emails.send(accessRequestNotification(request, admin, this.appUrl));
			} catch (error) {
				if (!(error instanceof EmailDeliveryError)) {
					throw error;
				}
				logger.warn('Access request notification failed', { requestId: request.id, err: error });
			}
		}
	}
}
