import { describe, expect, it } from 'vitest';
import { amountSchema, formatAmount } from '@/domain/recipe/amount';

describe('formatAmount', () => {
	it.each([
		[2, '2'],
		[10, '10'],
		[0.5, '½'],
		[2.5, '2½'],
		[0.25, '¼'],
		[1.25, '1¼'],
		[0.75, '¾'],
		[1 / 3, '⅓'],
		[0.33, '⅓'],
		[2 / 3, '⅔'],
		[1 + 2 / 3, '1⅔'],
		[0.125, '⅛'],
		[1.375, '1⅜'],
		[0.625, '⅝'],
		[2.875, '2⅞'],
		[1.996, '2'],
	])('writes %s as %s', (value, expected) => {
		expect(formatAmount({ min: value })).toBe(expected);
	});

	it.each([
		[0.1, '0.1'],
		[1.2, '1.2'],
		[0.15, '0.15'],
		[0.9, '0.9'],
		[3.14159, '3.14'],
		[0.005, '0.005'],
		[0.004, '0.004'],
		[0.0123, '0.012'],
	])('writes %s, which is no common fraction, as the decimal %s', (value, expected) => {
		expect(formatAmount({ min: value })).toBe(expected);
	});

	it('writes ranges with "to"', () => {
		expect(formatAmount({ min: 3, max: 4 })).toBe('3 to 4');
		expect(formatAmount({ min: 0.5, max: 1 })).toBe('½ to 1');
		expect(formatAmount({ min: 1.5, max: 2.25 })).toBe('1½ to 2¼');
	});
});

describe('amountSchema', () => {
	it('accepts a single value and a range', () => {
		expect(amountSchema.safeParse({ min: 0.5 }).success).toBe(true);
		expect(amountSchema.safeParse({ min: 2, max: 3 }).success).toBe(true);
	});

	it('rejects an amount that is not positive', () => {
		expect(amountSchema.safeParse({ min: 0 }).success).toBe(false);
		expect(amountSchema.safeParse({ min: -1 }).success).toBe(false);
	});

	it.each([2, 1])('rejects a range from 2 to %s at its end', (max) => {
		const result = amountSchema.safeParse({ min: 2, max });
		expect(result.error?.issues.map((issue) => issue.path)).toEqual([['max']]);
	});
});
