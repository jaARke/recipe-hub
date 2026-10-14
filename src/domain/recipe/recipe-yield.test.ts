import { describe, expect, it } from 'vitest';
import { writtenContent } from '@/domain/recipe/content-limits';
import { formatYield, recipeYieldSchemaFor } from '@/domain/recipe/recipe-yield';

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

describe('recipeYieldSchema', () => {
	it('rejects an unknown kind', () => {
		expect(recipeYieldSchema.safeParse({ kind: 'feeds', amount: { min: 4 } }).success).toBe(false);
	});
});
