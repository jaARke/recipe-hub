import { describe, expect, it } from 'vitest';
import { writtenContent } from '@/domain/recipe/content-limits';
import {
	formatYield,
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
});
