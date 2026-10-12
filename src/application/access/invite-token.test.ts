import { describe, expect, it } from 'vitest';
import {
	createInviteToken,
	hashInviteToken,
	isInviteToken,
} from '@/application/access/invite-token';

describe('createInviteToken', () => {
	it('makes a different 32-byte base64url token each time', () => {
		const tokens = new Set(Array.from({ length: 20 }, createInviteToken));

		expect(tokens.size).toBe(20);
		for (const token of tokens) {
			expect(token).toMatch(/^[\w-]{43}$/);
			expect(Buffer.from(token, 'base64url')).toHaveLength(32);
		}
	});
});

describe('isInviteToken', () => {
	it('accepts a token and nothing else', () => {
		expect(isInviteToken(createInviteToken())).toBe(true);
		expect(isInviteToken(`${createInviteToken()}=`)).toBe(false);
		expect(isInviteToken('')).toBe(false);
		expect(isInviteToken(undefined)).toBe(false);
	});
});

describe('hashInviteToken', () => {
	it('returns the SHA-256 digest as hex', async () => {
		expect(await hashInviteToken('abc')).toBe(
			'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
		);
	});
});
