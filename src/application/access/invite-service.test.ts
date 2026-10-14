import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { AccountService } from '@/application/access/account-service';
import {
	AccessRequestNotFoundError,
	InviteNotFoundError,
	InviteUnavailableError,
} from '@/application/access/errors';
import { InviteService } from '@/application/access/invite-service';
import { hashInviteToken } from '@/application/access/invite-token';
import { ForbiddenError, SignInRequiredError } from '@/application/authorization';
import type { Actor } from '@/application/ports/actor-provider';
import { actorFor, anonymousActor, memberActor } from '@/application/testing/actors';
import { FixedActorProvider } from '@/application/testing/fixed-actor-provider';
import { InMemoryAccessRequestRepository } from '@/application/testing/in-memory-access-request-repository';
import { InMemoryEmailSender } from '@/application/testing/in-memory-email-sender';
import { InMemoryInviteRepository } from '@/application/testing/in-memory-invite-repository';
import { InMemoryMemberRepository } from '@/application/testing/in-memory-member-repository';
import { daysInMilliseconds } from '@/lib/dates';
import { settings } from '@/lib/settings';

const appUrl = new URL('https://recipes.example.com');
// Evening in New York, so the expiry date in the email shows the site's zone, not UTC.
const issuedAt = new Date('2026-10-13T01:30:00Z');
const expiresAt = new Date(
	issuedAt.getTime() + daysInMilliseconds(settings.accounts.inviteLifetimeDays)
);
const minute = 60 * 1000;
const day = 24 * 60 * minute;

const missingId = '0199c7a4-2c3e-7b1a-9f00-2a7c1e4b5d6e';
const malformedId = 'not-an-id';

const refusedActors = [
	{ who: 'an anonymous visitor', actor: anonymousActor(), error: SignInRequiredError },
	{ who: 'a member who is not an admin', actor: memberActor(), error: ForbiddenError },
];

function createInvites() {
	const invites = new InMemoryInviteRepository();
	const requests = new InMemoryAccessRequestRepository();
	const members = new InMemoryMemberRepository(invites);
	const emails = new InMemoryEmailSender();
	const serviceFor = (actor: Actor) =>
		new InviteService(invites, requests, members, emails, new FixedActorProvider(actor), appUrl);
	return { invites, requests, members, emails, serviceFor };
}

async function invitesWithAdmin() {
	const context = createInvites();
	const admin = await context.members.create({
		email: 'jake@example.com',
		displayName: 'Jake',
		role: 'admin',
	});
	return {
		...context,
		admin,
		adminService: context.serviceFor(actorFor(admin)),
		visitor: context.serviceFor(anonymousActor()),
	};
}

function tokenOf(link: string): string {
	return new URL(link).hash.slice(1);
}

function advanceTime(ms: number): void {
	vi.setSystemTime(Date.now() + ms);
}

let consoleInfo: MockInstance<typeof console.info>;
let consoleWarn: MockInstance<typeof console.warn>;

function loggedText(): string {
	return [...consoleInfo.mock.calls, ...consoleWarn.mock.calls]
		.map(([line]) => String(line))
		.join('\n');
}

beforeEach(() => {
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(issuedAt);
	// Keeps log lines out of the test output; the logging tests read them here.
	consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => {});
	consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe('issueInvite', () => {
	it.each(refusedActors)('refuses $who', async ({ actor, error }) => {
		const { invites, serviceFor } = createInvites();

		await expect(serviceFor(actor).issueInvite({ displayName: 'Ada' })).rejects.toThrow(error);
		expect(await invites.listOpen(new Date())).toEqual([]);
	});

	it('returns a link whose token is stored only as its hash', async () => {
		const { invites, admin, adminService } = await invitesWithAdmin();

		const issued = await adminService.issueInvite({ displayName: ' Ada ' });

		expect(issued).toEqual({
			id: expect.any(String),
			displayName: 'Ada',
			link: expect.stringMatching(/^https:\/\/recipes\.example\.com\/invite#[\w-]{43}$/),
			delivery: { status: 'not-requested' },
		});
		const token = tokenOf(issued.link);
		expect(await invites.findByTokenHash(await hashInviteToken(token))).toEqual({
			id: issued.id,
			displayName: 'Ada',
			role: 'member',
			createdBy: admin.id,
			createdAt: issuedAt,
			expiresAt,
		});
		expect(await invites.findByTokenHash(token)).toBeNull();
	});

	it('rejects invalid fields with their paths before approving the request', async () => {
		const { requests, adminService } = await invitesWithAdmin();
		const request = await requests.create({ name: 'Ada', relationship: 'A neighbor.' });

		await expect(
			adminService.issueInvite({ displayName: ' ', sendTo: 'ada', requestId: request.id })
		).rejects.toThrow(
			expect.objectContaining({
				code: 'access.invalid-invite',
				problems: [
					{ path: 'displayName', message: expect.any(String) },
					{ path: 'sendTo', message: expect.any(String) },
				],
			})
		);
		expect(await requests.findById(request.id)).toMatchObject({ status: 'pending' });
	});

	it('marks the request approved and records it on the invite', async () => {
		const { requests, adminService } = await invitesWithAdmin();
		const request = await requests.create({ name: 'Ada', relationship: 'A neighbor.' });

		await adminService.issueInvite({ displayName: 'Ada', requestId: request.id });

		expect(await requests.findById(request.id)).toMatchObject({ status: 'approved' });
		expect(await adminService.listOpenInvites()).toEqual([
			expect.objectContaining({ requestId: request.id }),
		]);
	});

	it('refuses a request that is no longer pending, so a request yields one invite', async () => {
		const { requests, adminService } = await invitesWithAdmin();
		const request = await requests.create({ name: 'Ada', relationship: 'A neighbor.' });
		await adminService.issueInvite({ displayName: 'Ada', requestId: request.id });

		await expect(
			adminService.issueInvite({ displayName: 'Ada', requestId: request.id })
		).rejects.toThrow(AccessRequestNotFoundError);
		expect(await adminService.listOpenInvites()).toHaveLength(1);
	});

	it('leaves the request pending when the invite cannot be stored', async () => {
		const { invites, requests, adminService } = await invitesWithAdmin();
		const request = await requests.create({ name: 'Ada', relationship: 'A neighbor.' });
		vi.spyOn(invites, 'create').mockRejectedValueOnce(new Error('Database unavailable'));

		await expect(
			adminService.issueInvite({ displayName: 'Ada', requestId: request.id })
		).rejects.toThrow('Database unavailable');
		expect(await requests.findById(request.id)).toMatchObject({ status: 'pending' });
	});

	it('revokes its invite when another admin approved the request first', async () => {
		const { requests, adminService } = await invitesWithAdmin();
		const request = await requests.create({ name: 'Ada', relationship: 'A neighbor.' });
		vi.spyOn(requests, 'markApproved').mockResolvedValueOnce(null);

		await expect(
			adminService.issueInvite({ displayName: 'Ada', requestId: request.id })
		).rejects.toThrow(AccessRequestNotFoundError);
		expect(await adminService.listOpenInvites()).toEqual([]);
	});

	it.each([missingId, malformedId])('reports the request id %s as not found', async (id) => {
		const { adminService } = await invitesWithAdmin();

		await expect(adminService.issueInvite({ displayName: 'Ada', requestId: id })).rejects.toThrow(
			AccessRequestNotFoundError
		);
		expect(await adminService.listOpenInvites()).toEqual([]);
	});

	it('emails the link from the inviting admin, with its expiry date', async () => {
		const { emails, adminService } = await invitesWithAdmin();

		const issued = await adminService.issueInvite({
			displayName: 'Ada',
			sendTo: 'Ada@Example.com',
		});

		expect(issued.delivery).toEqual({ status: 'sent', to: 'ada@example.com' });
		expect(emails.sentMessages).toEqual([
			{
				to: 'ada@example.com',
				subject: 'Jake invited you to Barb’s Table',
				text:
					'Hi Ada,\n\n' +
					'Jake invited you to Barb’s Table, where you can add recipes to the shared collection.\n\n' +
					`Open this link to create your account:\n${issued.link}\n\n` +
					'The link works once and expires on October 19, 2026. To reach Jake, reply to this email.',
				replyTo: 'jake@example.com',
				idempotencyKey: `invite/${issued.id}`,
			},
		]);
	});

	it('logs a failed email and still returns the link to copy', async () => {
		const { emails, adminService } = await invitesWithAdmin();
		emails.failDeliveriesTo('ada@example.com');

		const issued = await adminService.issueInvite({
			displayName: 'Ada',
			sendTo: 'ada@example.com',
		});

		expect(issued).toMatchObject({
			delivery: { status: 'failed', to: 'ada@example.com' },
			link: expect.stringContaining('/invite#'),
		});
		expect(consoleWarn).toHaveBeenCalledOnce();
		expect(JSON.parse(String(consoleWarn.mock.calls[0]?.[0]))).toEqual({
			level: 'warn',
			logger: 'access',
			message: 'Invite email failed',
			inviteId: issued.id,
			err: expect.objectContaining({ code: 'email.delivery-failed' }),
		});
		expect(loggedText()).not.toContain(tokenOf(issued.link));
		expect(loggedText()).not.toContain('ada@example.com');
	});

	it('logs the invite by ids alone', async () => {
		const { requests, admin, adminService } = await invitesWithAdmin();
		const request = await requests.create({ name: 'Ada', relationship: 'A neighbor.' });

		const issued = await adminService.issueInvite({
			displayName: 'Ada',
			sendTo: 'ada@example.com',
			requestId: request.id,
		});

		expect(consoleInfo).toHaveBeenCalledOnce();
		expect(JSON.parse(String(consoleInfo.mock.calls[0]?.[0]))).toEqual({
			level: 'info',
			logger: 'access',
			message: 'Invite issued',
			inviteId: issued.id,
			requestId: request.id,
			memberId: admin.id,
			delivery: 'sent',
		});
		expect(loggedText()).not.toMatch(/Ada|Jake|@example\.com/);
		expect(loggedText()).not.toContain(tokenOf(issued.link));
	});
});

describe('listOpenInvites', () => {
	it.each(refusedActors)('refuses $who', async ({ actor, error }) => {
		const { serviceFor } = createInvites();

		await expect(serviceFor(actor).listOpenInvites()).rejects.toThrow(error);
	});

	it('lists open invites newest first, leaving out used, revoked, and expired ones', async () => {
		const { invites, adminService, visitor } = await invitesWithAdmin();
		const lastDay = (settings.accounts.inviteLifetimeDays - 1) * day;
		await adminService.issueInvite({ displayName: 'Expired' });
		advanceTime(lastDay);
		const used = await adminService.issueInvite({ displayName: 'Used' });
		invites.accept(used.id, memberActor().memberId);
		const revoked = await adminService.issueInvite({ displayName: 'Revoked' });
		await adminService.revokeInvite(revoked.id);
		advanceTime(minute);
		const older = await adminService.issueInvite({ displayName: 'Grace' });
		advanceTime(minute);
		const newer = await adminService.issueInvite({ displayName: 'Ada' });
		await visitor.bindInviteEmail(tokenOf(newer.link), 'ada@example.com');
		vi.setSystemTime(expiresAt);

		expect(await adminService.listOpenInvites()).toEqual([
			{
				id: newer.id,
				displayName: 'Ada',
				email: 'ada@example.com',
				createdAt: new Date(issuedAt.getTime() + lastDay + 2 * minute),
				expiresAt: new Date(expiresAt.getTime() + lastDay + 2 * minute),
			},
			{
				id: older.id,
				displayName: 'Grace',
				createdAt: new Date(issuedAt.getTime() + lastDay + minute),
				expiresAt: new Date(expiresAt.getTime() + lastDay + minute),
			},
		]);
	});
});

describe('revokeInvite', () => {
	it.each(refusedActors)('refuses $who and keeps the invite open', async ({ actor, error }) => {
		const { adminService, serviceFor, visitor } = await invitesWithAdmin();
		const issued = await adminService.issueInvite({ displayName: 'Ada' });

		await expect(serviceFor(actor).revokeInvite(issued.id)).rejects.toThrow(error);
		expect(await visitor.getInvitePreview(tokenOf(issued.link))).not.toBeNull();
	});

	it('revokes the invite, so its link stops working', async () => {
		const { adminService, visitor } = await invitesWithAdmin();
		const issued = await adminService.issueInvite({ displayName: 'Ada' });

		await adminService.revokeInvite(issued.id);

		expect(await visitor.getInvitePreview(tokenOf(issued.link))).toBeNull();
		expect(await adminService.listOpenInvites()).toEqual([]);
	});

	it.each([missingId, malformedId])('reports the id %s as not found', async (id) => {
		const { adminService } = await invitesWithAdmin();

		await expect(adminService.revokeInvite(id)).rejects.toThrow(InviteNotFoundError);
	});

	it('reports an invite that is no longer open as not found', async () => {
		const { adminService } = await invitesWithAdmin();
		const issued = await adminService.issueInvite({ displayName: 'Ada' });
		await adminService.revokeInvite(issued.id);

		await expect(adminService.revokeInvite(issued.id)).rejects.toThrow(InviteNotFoundError);
	});

	it('logs the revocation by ids alone', async () => {
		const { admin, adminService } = await invitesWithAdmin();
		const issued = await adminService.issueInvite({ displayName: 'Ada' });

		await adminService.revokeInvite(issued.id);

		expect(JSON.parse(String(consoleInfo.mock.lastCall?.[0]))).toEqual({
			level: 'info',
			logger: 'access',
			message: 'Invite revoked',
			inviteId: issued.id,
			memberId: admin.id,
		});
	});
});

describe('getInvitePreview', () => {
	it('shows the invitee name and the expiry, and nothing else', async () => {
		const { adminService, visitor } = await invitesWithAdmin();
		const issued = await adminService.issueInvite({ displayName: 'Ada' });
		await visitor.bindInviteEmail(tokenOf(issued.link), 'ada@example.com');

		expect(await visitor.getInvitePreview(tokenOf(issued.link))).toEqual({
			displayName: 'Ada',
			expiresAt,
		});
	});

	it('never asks who is calling', async () => {
		const { invites, requests, members, emails, adminService } = await invitesWithAdmin();
		const issued = await adminService.issueInvite({ displayName: 'Ada' });
		const actors = new FixedActorProvider(memberActor());
		const service = new InviteService(invites, requests, members, emails, actors, appUrl);

		await service.getInvitePreview(tokenOf(issued.link));
		await service.bindInviteEmail(tokenOf(issued.link), 'ada@example.com');

		expect(actors.wasAsked).toBe(false);
	});

	it.each(['A'.repeat(43), 'not a token', ''])('returns null for the token "%s"', async (token) => {
		const { visitor } = await invitesWithAdmin();

		expect(await visitor.getInvitePreview(token)).toBeNull();
	});

	it('returns null once the invite is used, revoked, or expired', async () => {
		const { invites, adminService, visitor } = await invitesWithAdmin();
		const used = await adminService.issueInvite({ displayName: 'Used' });
		invites.accept(used.id, memberActor().memberId);
		const revoked = await adminService.issueInvite({ displayName: 'Revoked' });
		await adminService.revokeInvite(revoked.id);
		const expired = await adminService.issueInvite({ displayName: 'Expired' });
		expect(await visitor.getInvitePreview(tokenOf(expired.link))).not.toBeNull();

		vi.setSystemTime(expiresAt);

		for (const { link } of [used, revoked, expired]) {
			expect(await visitor.getInvitePreview(tokenOf(link))).toBeNull();
		}
	});
});

describe('bindInviteEmail', () => {
	it('binds the normalized address to the invite and returns it', async () => {
		const { invites, adminService, visitor } = await invitesWithAdmin();
		const issued = await adminService.issueInvite({ displayName: 'Ada' });

		expect(await visitor.bindInviteEmail(tokenOf(issued.link), ' Ada@Example.com ')).toBe(
			'ada@example.com'
		);
		expect(await invites.findOpenByEmail('ada@example.com', new Date())).toMatchObject({
			id: issued.id,
		});
	});

	it('rejects an invalid address under the email field', async () => {
		const { adminService, visitor } = await invitesWithAdmin();
		const issued = await adminService.issueInvite({ displayName: 'Ada' });

		await expect(visitor.bindInviteEmail(tokenOf(issued.link), 'ada@')).rejects.toThrow(
			expect.objectContaining({
				code: 'access.invalid-email',
				problems: [{ path: 'email', message: expect.any(String) }],
			})
		);
	});

	it('refuses an unknown link', async () => {
		const { visitor } = await invitesWithAdmin();

		await expect(visitor.bindInviteEmail('A'.repeat(43), 'ada@example.com')).rejects.toThrow(
			InviteUnavailableError
		);
	});

	it('refuses an invite that is used, revoked, or expired', async () => {
		const { invites, adminService, visitor } = await invitesWithAdmin();
		const used = await adminService.issueInvite({ displayName: 'Used' });
		invites.accept(used.id, memberActor().memberId);
		const revoked = await adminService.issueInvite({ displayName: 'Revoked' });
		await adminService.revokeInvite(revoked.id);
		const expired = await adminService.issueInvite({ displayName: 'Expired' });
		vi.setSystemTime(expiresAt);

		for (const { link } of [used, revoked, expired]) {
			await expect(visitor.bindInviteEmail(tokenOf(link), 'ada@example.com')).rejects.toThrow(
				InviteUnavailableError
			);
		}
		expect(await invites.findOpenByEmail('ada@example.com', issuedAt)).toBeNull();
	});
});

describe('completeInvite', () => {
	it('refuses an anonymous visitor and keeps the invite open', async () => {
		const { adminService, visitor } = await invitesWithAdmin();
		const issued = await adminService.issueInvite({ displayName: 'Ada' });
		await visitor.bindInviteEmail(tokenOf(issued.link), 'ada@example.com');

		await expect(visitor.completeInvite(tokenOf(issued.link))).rejects.toThrow(SignInRequiredError);
		expect(await visitor.getInvitePreview(tokenOf(issued.link))).not.toBeNull();
	});

	it('reports a new account when the invite created the member', async () => {
		const { invites, members, adminService, visitor, serviceFor } = await invitesWithAdmin();
		const issued = await adminService.issueInvite({ displayName: 'Ada' });
		await visitor.bindInviteEmail(tokenOf(issued.link), 'ada@example.com');
		const ada = await members.create({
			email: 'ada@example.com',
			displayName: 'Ada',
			role: 'member',
		});
		invites.accept(issued.id, ada.id);

		expect(await serviceFor(actorFor(ada)).completeInvite(tokenOf(issued.link))).toEqual({
			account: 'created',
		});
		const invite = await invites.findByTokenHash(await hashInviteToken(tokenOf(issued.link)));
		expect(invite).toMatchObject({ acceptedBy: ada.id });
		expect(invite?.revokedAt).toBeUndefined();
	});

	it('tells a member who already had an account so, and revokes the invite', async () => {
		const { members, adminService, visitor, serviceFor } = await invitesWithAdmin();
		const ada = await members.create({
			email: 'ada@example.com',
			displayName: 'Ada',
			role: 'member',
		});
		advanceTime(day);
		const issued = await adminService.issueInvite({ displayName: 'Ada' });
		await visitor.bindInviteEmail(tokenOf(issued.link), 'ada@example.com');

		expect(await serviceFor(actorFor(ada)).completeInvite(tokenOf(issued.link))).toEqual({
			account: 'existing',
		});
		expect(await visitor.getInvitePreview(tokenOf(issued.link))).toBeNull();
		expect(await adminService.listOpenInvites()).toEqual([]);
	});

	it('reports an existing account for an invite already used, revoked, or expired', async () => {
		const { invites, members, adminService, serviceFor } = await invitesWithAdmin();
		const ada = await members.create({
			email: 'ada@example.com',
			displayName: 'Ada',
			role: 'member',
		});
		advanceTime(day);
		const used = await adminService.issueInvite({ displayName: 'Used' });
		invites.accept(used.id, memberActor().memberId);
		const revoked = await adminService.issueInvite({ displayName: 'Revoked' });
		await adminService.revokeInvite(revoked.id);
		const expired = await adminService.issueInvite({ displayName: 'Expired' });
		vi.setSystemTime(expiresAt.getTime() + day);

		for (const { link } of [used, revoked, expired]) {
			expect(await serviceFor(actorFor(ada)).completeInvite(tokenOf(link))).toEqual({
				account: 'existing',
			});
		}
		expect(loggedText()).not.toContain('Invite revoked at sign-in');
	});

	it('reports a new account through either link when two are bound to the address', async () => {
		const { invites, members, emails, adminService, visitor, serviceFor } =
			await invitesWithAdmin();
		const older = await adminService.issueInvite({ displayName: 'Ada' });
		advanceTime(minute);
		const newer = await adminService.issueInvite({ displayName: 'Ada' });
		await visitor.bindInviteEmail(tokenOf(older.link), 'ada@example.com');
		await visitor.bindInviteEmail(tokenOf(newer.link), 'ada@example.com');
		advanceTime(minute);
		const grant = await new AccountService(members, invites, emails).authorizeSignUp(
			'ada@example.com'
		);
		expect(grant?.inviteId).toBe(newer.id);
		const ada = await members.create({
			email: 'ada@example.com',
			displayName: 'Ada',
			role: 'member',
		});
		invites.accept(newer.id, ada.id);

		for (const { link } of [older, newer]) {
			expect(await serviceFor(actorFor(ada)).completeInvite(tokenOf(link))).toEqual({
				account: 'created',
			});
		}
		expect(await adminService.listOpenInvites()).toEqual([]);
	});

	it.each(['A'.repeat(43), 'not a token'])('refuses the token "%s"', async (token) => {
		const { admin, serviceFor } = await invitesWithAdmin();

		await expect(serviceFor(actorFor(admin)).completeInvite(token)).rejects.toThrow(
			InviteUnavailableError
		);
	});

	it('logs the revocation by ids alone', async () => {
		const { members, adminService, visitor, serviceFor } = await invitesWithAdmin();
		const ada = await members.create({
			email: 'ada@example.com',
			displayName: 'Ada',
			role: 'member',
		});
		advanceTime(day);
		const issued = await adminService.issueInvite({ displayName: 'Ada' });
		await visitor.bindInviteEmail(tokenOf(issued.link), 'ada@example.com');

		await serviceFor(actorFor(ada)).completeInvite(tokenOf(issued.link));

		expect(JSON.parse(String(consoleInfo.mock.lastCall?.[0]))).toEqual({
			level: 'info',
			logger: 'access',
			message: 'Invite revoked at sign-in',
			inviteId: issued.id,
			memberId: ada.id,
			account: 'existing',
		});
		expect(loggedText()).not.toMatch(/Ada|@example\.com/);
		expect(loggedText()).not.toContain(tokenOf(issued.link));
	});
});
