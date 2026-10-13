import { describe, expect, it } from 'vitest';
import { tagLabelSchema, tagListSchema } from '@/domain/recipe/tag';

describe('tagLabelSchema', () => {
	it('normalizes the label', () => {
		expect(tagLabelSchema.parse('  Slow   cooked ')).toBe('Slow cooked');
	});

	it('strips NUL, which Postgres cannot store, rather than refusing it', () => {
		expect(tagLabelSchema.parse('Bak\0ing')).toBe('Baking');
	});

	it('rejects a blank label', () => {
		expect(tagLabelSchema.safeParse(' \t ').success).toBe(false);
	});

	it('rejects a label of only control characters as blank', () => {
		const result = tagLabelSchema.safeParse('\0\u0002\u007F');
		expect(result.error?.issues.map((issue) => issue.message)).toEqual(['Enter a tag.']);
	});
});

describe('tagListSchema', () => {
	it('drops repeats so the first spelling wins', () => {
		expect(
			tagListSchema.parse(['Baking', ' baking ', 'Make  ahead', 'BAKING', 'make ahead'])
		).toEqual(['Baking', 'Make ahead']);
	});

	it('drops a repeat that differs only in control characters', () => {
		expect(tagListSchema.parse(['Soup', 'So\0up'])).toEqual(['Soup']);
	});
});
