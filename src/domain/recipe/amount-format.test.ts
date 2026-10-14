import { describe, expect, it } from 'vitest';
import { formatAmount } from '@/domain/recipe/amount-format';

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

	it.each([
		[2.5, 'g', '2.5'],
		[1.5, 'kg', '1.5'],
		[0.75, 'kilograms', '0.75'],
		[0.125, 'l', '0.125'],
		[1 / 3, 'kg', '0.333'],
		[166.67, 'grams', '166.67'],
	])(
		'writes %s in %s, which would read as a fraction, as the decimal %s',
		(value, unit, expected) => {
			expect(formatAmount({ min: value }, unit)).toBe(expected);
		}
	);

	it.each([
		[500, 'g', '500'],
		[250, 'mL', '250'],
		[1.23, 'l', '1.23'],
		[0.7333, 'kg', '0.73'],
		[0.005, 'l', '0.005'],
		[2, 'liters', '2'],
		[1.996, 'kg', '2'],
	])('writes %s in %s as it reads today, %s, rounding to no step', (value, unit, expected) => {
		expect(formatAmount({ min: value }, unit)).toBe(expected);
	});

	it('writes a metric range in decimals at both ends', () => {
		expect(formatAmount({ min: 1, max: 1.5 }, 'kg')).toBe('1 to 1.5');
	});

	it.each([
		[1.5, 'cups', '1½'],
		[0.25, 'tsp', '¼'],
		[12, 'oz (340 g)', '12'],
		[0.5, 'can (14 ounces)', '½'],
	])('writes %s in %s, which is not metric, as a fraction', (value, unit, expected) => {
		expect(formatAmount({ min: value }, unit)).toBe(expected);
	});
});
