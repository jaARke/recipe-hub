import { describe, expect, it } from 'vitest';
import { amountSchema } from '@/domain/recipe/amount';

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
