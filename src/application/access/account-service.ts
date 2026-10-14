import 'server-only';
import { toSignUpGrant, type SignUpGrant } from '@/application/access/access-dtos';
import {
	EmailDeliveryError,
	type EmailMessage,
	type EmailSender,
} from '@/application/ports/email-sender';
import type { InviteRepository } from '@/application/ports/invite-repository';
import type { MemberRepository } from '@/application/ports/member-repository';
import type { InviteId } from '@/domain/member/invite';
import { emailAddressSchema, type MemberId } from '@/domain/member/member';
import { getLogger } from '@/lib/logger';
import { settings } from '@/lib/settings';

const logger = getLogger('access');

function signInCodeEmail(to: string, code: string): EmailMessage {
	return {
		to,
		kind: 'sign-in-code',
		data: { code, lifetimeMinutes: settings.accounts.signInCodeLifetimeMinutes },
	};
}

// System use cases for the auth adapter, which calls them from Better Auth's hooks with no actor.
export class AccountService {
	private readonly members: MemberRepository;
	private readonly invites: InviteRepository;
	private readonly emails: EmailSender;

	constructor(members: MemberRepository, invites: InviteRepository, emails: EmailSender) {
		this.members = members;
		this.invites = invites;
		this.emails = emails;
	}

	// Runs in the background after Better Auth answers, so it never throws for an address that may
	// not receive a code, and every address gets the same response.
	async sendSignInCode(email: string, code: string): Promise<void> {
		const parsed = emailAddressSchema.safeParse(email);
		if (!parsed.success || !(await this.mayReceiveCode(parsed.data))) {
			return;
		}

		try {
			await this.emails.send(signInCodeEmail(parsed.data, code));
		} catch (error) {
			if (!(error instanceof EmailDeliveryError)) {
				throw error;
			}
			logger.error('Sign-in code email failed', { err: error });
		}
	}

	// Null refuses the account: only an open invite bound to the address lets one be created.
	async authorizeSignUp(email: string): Promise<SignUpGrant | null> {
		const parsed = emailAddressSchema.safeParse(email);
		const invite = parsed.success
			? await this.invites.findOpenByEmail(parsed.data, new Date())
			: null;
		return invite === null ? null : toSignUpGrant(invite);
	}

	recordSignUp(memberId: MemberId, inviteId: InviteId): void {
		logger.info('Access granted', { memberId, inviteId });
	}

	// Members sign in with codes; an invitee confirms the address bound to their open invite. A
	// removed member's account holds an address on the .invalid domain, which gets none, and their own
	// address is free, so a new invite to it lets them confirm it like any invitee.
	private async mayReceiveCode(email: string): Promise<boolean> {
		const member = await this.members.findByEmail(email);
		if (member !== null) {
			return member.removedAt === undefined;
		}

		return (await this.invites.findOpenByEmail(email, new Date())) !== null;
	}
}
