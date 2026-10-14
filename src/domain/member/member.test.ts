import { describe, expect, it } from 'vitest';
import { InvalidProfileError } from '@/domain/member/errors';
import {
	displayNameSchema,
	emailAddressSchema,
	memberIdSchema,
	parseDisplayName,
	removedMemberEmail,
} from '@/domain/member/member';

describe('displayNameSchema', () => {
	it('trims the name', () => {
		expect(displayNameSchema.parse('  Ada Lovelace ')).toBe('Ada Lovelace');
	});

	it('accepts 1 to 60 characters', () => {
		expect(displayNameSchema.safeParse('A').success).toBe(true);
		expect(displayNameSchema.safeParse('a'.repeat(60)).success).toBe(true);
		expect(displayNameSchema.safeParse('a'.repeat(61)).success).toBe(false);
	});

	it('rejects a blank name', () => {
		expect(displayNameSchema.safeParse(' \t ').success).toBe(false);
	});
});

describe('emailAddressSchema', () => {
	it('trims and lowercases the address', () => {
		expect(emailAddressSchema.parse('  Ada.Lovelace@Example.COM ')).toBe(
			'ada.lovelace@example.com'
		);
	});

	it('rejects text that is not an address', () => {
		expect(emailAddressSchema.safeParse('ada at example.com').success).toBe(false);
		expect(emailAddressSchema.safeParse('').success).toBe(false);
	});
});

describe('removedMemberEmail', () => {
	const id = memberIdSchema.parse('0199c7a4-2c3e-7b1a-9f00-2a7c1e4b5d6e');

	it('names the account on the .invalid domain', () => {
		expect(removedMemberEmail(id)).toBe(
			'removed+0199c7a4-2c3e-7b1a-9f00-2a7c1e4b5d6e@recipes.invalid'
		);
	});

	it('is an address a member can hold', () => {
		expect(emailAddressSchema.parse(removedMemberEmail(id))).toBe(removedMemberEmail(id));
	});
});

describe('parseDisplayName', () => {
	it('returns the trimmed name', () => {
		expect(parseDisplayName(' Ada ')).toBe('Ada');
	});

	it('reports a problem under the form field', () => {
		expect(() => parseDisplayName(' ')).toThrow(InvalidProfileError);
		expect(() => parseDisplayName('a'.repeat(61))).toThrow(
			expect.objectContaining({
				code: 'member.invalid-profile',
				problems: [{ path: 'displayName', message: 'Use 60 characters or fewer.' }],
			})
		);
	});
});
