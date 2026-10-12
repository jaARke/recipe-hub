import { describe, expect, it } from 'vitest';
import {
	inviteExpiry,
	inviteIdSchema,
	inviteStatus,
	parseInviteEmail,
	parseInviteFields,
	type Invite,
} from '@/domain/member/invite';
import { memberIdSchema } from '@/domain/member/member';

const now = new Date('2026-10-12T15:00:00Z');

const openInvite: Invite = {
	id: inviteIdSchema.parse('0199d8a0-7c4e-7b1a-9f00-2a7c1e4b5d6e'),
	displayName: 'Ada Lovelace',
	role: 'member',
	createdBy: memberIdSchema.parse('0199d8a0-7c4e-7b1a-9f00-2a7c1e4b5d6f'),
	createdAt: new Date('2026-10-10T15:00:00Z'),
	expiresAt: new Date('2026-10-17T15:00:00Z'),
};

describe('inviteStatus', () => {
	it('is open before it expires', () => {
		expect(inviteStatus(openInvite, now)).toBe('open');
	});

	it('expires at its expiry time', () => {
		expect(inviteStatus(openInvite, openInvite.expiresAt)).toBe('expired');
	});

	it('is revoked once revoked, even after it would have expired', () => {
		const revoked = { ...openInvite, revokedAt: now };

		expect(inviteStatus(revoked, now)).toBe('revoked');
		expect(inviteStatus(revoked, new Date('2026-11-01T00:00:00Z'))).toBe('revoked');
	});

	it('is accepted once an account used it, whatever else happened', () => {
		const accepted = {
			...openInvite,
			revokedAt: now,
			acceptedBy: memberIdSchema.parse('0199d8a0-7c4e-7b1a-9f00-2a7c1e4b5d70'),
		};

		expect(inviteStatus(accepted, new Date('2026-11-01T00:00:00Z'))).toBe('accepted');
	});
});

describe('inviteExpiry', () => {
	it('is seven days after creation', () => {
		expect(inviteExpiry(now)).toEqual(new Date('2026-10-19T15:00:00Z'));
	});
});

describe('parseInviteFields', () => {
	it('trims the name and normalizes the address to send to', () => {
		expect(parseInviteFields({ displayName: ' Ada ', sendTo: ' Ada@Example.com' })).toEqual({
			displayName: 'Ada',
			sendTo: 'ada@example.com',
		});
		expect(parseInviteFields({ displayName: 'Ada' })).toEqual({ displayName: 'Ada' });
	});

	it('reports every problem with its field path', () => {
		expect(() => parseInviteFields({ displayName: 'a'.repeat(61), sendTo: 'ada' })).toThrow(
			expect.objectContaining({
				code: 'access.invalid-invite',
				problems: [
					{ path: 'displayName', message: 'Use 60 characters or fewer.' },
					{ path: 'sendTo', message: 'Enter an email address, like name@example.com.' },
				],
			})
		);
	});
});

describe('parseInviteEmail', () => {
	it('normalizes the address', () => {
		expect(parseInviteEmail(' Ada@Example.com ')).toBe('ada@example.com');
	});

	it('reports a problem under the form field', () => {
		expect(() => parseInviteEmail('ada@')).toThrow(
			expect.objectContaining({
				code: 'access.invalid-email',
				problems: [{ path: 'email', message: 'Enter an email address, like name@example.com.' }],
			})
		);
	});
});
