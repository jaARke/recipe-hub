import { describe, expect, it } from 'vitest';
import { writtenContent } from '@/domain/recipe/content-limits';
import {
	formatYield,
	readYieldAmount,
	recipeYieldSchemaFor,
	scaleYield,
	type RecipeYield,
} from '@/domain/recipe/recipe-yield';

const recipeYieldSchema = recipeYieldSchemaFor(writtenContent);

describe('formatYield', () => {
	it('writes servings', () => {
		expect(formatYield({ kind: 'servings', amount: { min: 6 } })).toBe('Serves 6');
		expect(formatYield({ kind: 'servings', amount: { min: 4, max: 6 } })).toBe('Serves 4 to 6');
	});

	it('writes counts with and without a unit', () => {
		expect(formatYield({ kind: 'makes', amount: { min: 10 } })).toBe('Makes 10');
		expect(formatYield({ kind: 'makes', amount: { min: 10 }, unit: 'biscuits' })).toBe(
			'Makes 10 biscuits'
		);
	});
});

describe('scaleYield', () => {
	it.each<[RecipeYield, number, string]>([
		[{ kind: 'servings', amount: { min: 6 } }, 4 / 6, 'Serves 4'],
		[{ kind: 'makes', amount: { min: 24 }, unit: 'cookies' }, 36 / 24, 'Makes 36 cookies'],
		[{ kind: 'servings', amount: { min: 4, max: 6 } }, 2, 'Serves 8 to 12'],
		[{ kind: 'makes', amount: { min: 1 }, unit: 'loaf' }, 2, 'Makes 2 loaves'],
		[{ kind: 'makes', amount: { min: 10 } }, 1 / 2, 'Makes 5'],
	])('scales %j by %s to read "%s"', (recipeYield, factor, expected) => {
		expect(formatYield(scaleYield(recipeYield, factor))).toBe(expected);
	});

	it('leaves the yield as it is at the original scale', () => {
		const recipeYield: RecipeYield = { kind: 'makes', amount: { min: 1 }, unit: 'loaf' };
		expect(scaleYield(recipeYield, 1)).toBe(recipeYield);
	});
});

describe('recipeYieldSchema', () => {
	it('rejects an unknown kind', () => {
		expect(recipeYieldSchema.safeParse({ kind: 'feeds', amount: { min: 4 } }).success).toBe(false);
	});

	it.each([
		['cookies.', 'cookies'],
		['dozen cookies ;', 'dozen cookies'],
		['2 in cookies:', '2 in cookies'],
		['doz.', 'doz.'],
		['loaves [?].', 'loaves [?]'],
	])('stores what a recipe makes, %j, without the punctuation that ends it', (unit, stored) => {
		expect(recipeYieldSchema.parse({ kind: 'makes', amount: { min: 12 }, unit })).toEqual({
			kind: 'makes',
			amount: { min: 12 },
			unit: stored,
		});
	});
});

describe('readYieldAmount', () => {
	it.each([
		['4', { min: 4 }],
		['4.', { min: 4 }],
		[' 4 to 6; ', { min: 4, max: 6 }],
		['1½,', { min: 1.5 }],
		['12:', { min: 12 }],
	])('reads %j without the punctuation that ends it', (text, amount) => {
		expect(readYieldAmount(text)).toStrictEqual(amount);
	});

	it.each([
		['four', { min: 4 }],
		['Four.', { min: 4 }],
		['four to six', { min: 4, max: 6 }],
		['two and a half', { min: 2.5 }],
	])('reads the amount in words in %j', (text, amount) => {
		expect(readYieldAmount(text)).toStrictEqual(amount);
	});

	it.each(['4 [?]', '4?', 'a few.', '.', 'half', 'a'])('reads no amount in %j', (text) => {
		expect(readYieldAmount(text)).toBeUndefined();
	});
});
