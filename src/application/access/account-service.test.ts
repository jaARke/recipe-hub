import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { AccountService } from '@/application/access/account-service';
import { memberActor } from '@/application/testing/actors';
import { InMemoryEmailSender } from '@/application/testing/in-memory-email-sender';
import { InMemoryFavoriteRepository } from '@/application/testing/in-memory-favorite-repository';
import { InMemoryInviteRepository } from '@/application/testing/in-memory-invite-repository';
import { InMemoryMemberRepository } from '@/application/testing/in-memory-member-repository';
import { InMemoryRecipeRepository } from '@/application/testing/in-memory-recipe-repository';
import { inviteExpiry, type Invite } from '@/domain/member/invite';
import { removedMemberEmail } from '@/domain/member/member';
import { settings } from '@/lib/settings';

const now = new Date('2026-10-12T15:00:00Z');
const minute = 60 * 1000;
const code = '482915';

function createAccounts() {
	const invites = new InMemoryInviteRepository();
	const members = new InMemoryMemberRepository(
		invites,
		new InMemoryFavoriteRepository(new InMemoryRecipeRepository())
	);
	const emails = new InMemoryEmailSender();
	const service = new AccountService(members, invites, emails);

	// An invite as the admin page leaves it, bound to an address when the invitee entered one.
	const createInvite = async (displayName: string, email?: string): Promise<Invite> => {
		const invite = await invites.create({
			tokenHash: crypto.randomUUID(),
			displayName,
			role: 'member',
			createdBy: memberActor().memberId,
			expiresAt: inviteExpiry(new Date()),
		});
		return email === undefined
			? invite
			: ((await invites.bindEmail(invite.id, email, new Date())) ?? invite);
	};

	return { members, invites, emails, service, createInvite };
}

let consoleInfo: MockInstance<typeof console.info>;
let consoleError: MockInstance<typeof console.error>;

beforeEach(() => {
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(now);
	// Keeps log lines out of the test output; the logging tests read them here.
	consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => {});
	consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe('sendSignInCode', () => {
	it('sends a member the code and how long it works, with no reply-to', async () => {
		const { members, emails, service } = createAccounts();
		await members.create({ email: 'ada@example.com', displayName: 'Ada', role: 'member' });

		await service.sendSignInCode('Ada@Example.com', code);

		expect(emails.sentMessages).toEqual([
			{
				to: 'ada@example.com',
				kind: 'sign-in-code',
				data: { code: '482915', lifetimeMinutes: settings.accounts.signInCodeLifetimeMinutes },
			},
		]);
	});

	it('sends the code to an address bound to an open invite', async () => {
		const { emails, service, createInvite } = createAccounts();
		await createInvite('Ada', 'ada@example.com');

		await service.sendSignInCode('ada@example.com', code);

		expect(emails.sentMessages.map(({ to }) => to)).toEqual(['ada@example.com']);
	});

	it('sends nothing, and does not throw, for an address with no account or open invite', async () => {
		const { invites, emails, service, createInvite } = createAccounts();
		await createInvite('Unbound');
		const used = await createInvite('Used', 'used@example.com');
		invites.accept(used.id, memberActor().memberId);
		const revoked = await createInvite('Revoked', 'revoked@example.com');
		await invites.revoke(revoked.id, new Date());
		await createInvite('Expired', 'expired@example.com');
		vi.setSystemTime(inviteExpiry(now));

		for (const email of [
			'stranger@example.com',
			'used@example.com',
			'revoked@example.com',
			'expired@example.com',
			'not an address',
		]) {
			await expect(service.sendSignInCode(email, code)).resolves.toBeUndefined();
		}
		expect(emails.sentMessages).toEqual([]);
	});

	it("sends nothing for a removed member, at the account's new address or their own", async () => {
		const { members, emails, service } = createAccounts();
		const ada = await members.create({
			email: 'ada@example.com',
			displayName: 'Ada',
			role: 'member',
		});
		await members.remove(ada.id);

		for (const email of ['ada@example.com', removedMemberEmail(ada.id)]) {
			await expect(service.sendSignInCode(email, code)).resolves.toBeUndefined();
		}
		expect(emails.sentMessages).toEqual([]);
	});

	it("sends the code to a removed member's own address once a new invite is bound to it", async () => {
		const { members, emails, service, createInvite } = createAccounts();
		const ada = await members.create({
			email: 'ada@example.com',
			displayName: 'Ada',
			role: 'member',
		});
		await members.remove(ada.id);
		await createInvite('Ada', 'ada@example.com');

		await service.sendSignInCode('ada@example.com', code);

		expect(emails.sentMessages.map(({ to }) => to)).toEqual(['ada@example.com']);
	});

	it('logs a failed email without the address or code, and does not throw', async () => {
		const { members, emails, service } = createAccounts();
		await members.create({ email: 'ada@example.com', displayName: 'Ada', role: 'member' });
		emails.failDeliveriesTo('ada@example.com');

		await expect(service.sendSignInCode('ada@example.com', code)).resolves.toBeUndefined();

		expect(consoleError).toHaveBeenCalledOnce();
		const line = String(consoleError.mock.calls[0]?.[0]);
		expect(JSON.parse(line)).toEqual({
			level: 'error',
			logger: 'access',
			message: 'Sign-in code email failed',
			err: expect.objectContaining({ code: 'email.delivery-failed' }),
		});
		expect(line).not.toContain('ada@example.com');
		expect(line).not.toContain(code);
	});
});

describe('authorizeSignUp', () => {
	it('grants what the newest open invite bound to the address holds', async () => {
		const { service, createInvite } = createAccounts();
		await createInvite('Ada L.', 'ada@example.com');
		vi.setSystemTime(now.getTime() + minute);
		const newest = await createInvite('Ada', 'ada@example.com');
		await createInvite('Grace', 'grace@example.com');

		expect(await service.authorizeSignUp('Ada@Example.com')).toEqual({
			inviteId: newest.id,
			displayName: 'Ada',
			role: 'member',
		});
	});

	it('refuses an address with no open invite', async () => {
		const { invites, service, createInvite } = createAccounts();
		const used = await createInvite('Used', 'used@example.com');
		invites.accept(used.id, memberActor().memberId);
		const revoked = await createInvite('Revoked', 'revoked@example.com');
		await invites.revoke(revoked.id, new Date());
		await createInvite('Expired', 'expired@example.com');
		vi.setSystemTime(inviteExpiry(now));

		for (const email of [
			'stranger@example.com',
			'used@example.com',
			'revoked@example.com',
			'expired@example.com',
			'not an address',
		]) {
			expect(await service.authorizeSignUp(email)).toBeNull();
		}
	});
});

describe('recordSignUp', () => {
	it('logs the granted access by ids', async () => {
		const { service, createInvite } = createAccounts();
		const invite = await createInvite('Ada', 'ada@example.com');
		const memberId = memberActor().memberId;

		service.recordSignUp(memberId, invite.id);

		expect(consoleInfo).toHaveBeenCalledOnce();
		expect(JSON.parse(String(consoleInfo.mock.calls[0]?.[0]))).toEqual({
			level: 'info',
			logger: 'access',
			message: 'Access granted',
			memberId,
			inviteId: invite.id,
		});
	});
});
