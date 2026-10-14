import { describe, expect, it } from 'vitest';
import { storedContent, writtenContent } from '@/domain/recipe/content-limits';
import { tagLabelSchema, tagListSchemaFor } from '@/domain/recipe/tag';
import { settings } from '@/lib/settings';

const tagListSchema = tagListSchemaFor(writtenContent);

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

describe('tagListSchemaFor', () => {
	const longTag = 'a'.repeat(settings.recipeLimits.maxTagLength + 1);
	const manyTags = Array.from(
		{ length: settings.recipeLimits.maxTagsPerRecipe + 1 },
		(_, index) => `Tag ${index}`
	);

	it('drops repeats so the first spelling wins', () => {
		expect(
			tagListSchema.parse(['Baking', ' baking ', 'Make  ahead', 'BAKING', 'make ahead'])
		).toEqual(['Baking', 'Make ahead']);
	});

	it('drops a repeat that differs only in control characters', () => {
		expect(tagListSchema.parse(['Soup', 'So\0up'])).toEqual(['Soup']);
	});

	it('refuses a written tag past the length limit', () => {
		expect(tagListSchema.safeParse(['Soup', longTag]).error?.issues).toEqual([
			expect.objectContaining({
				path: [1],
				message: `Use ${settings.recipeLimits.maxTagLength} characters or fewer.`,
			}),
		]);
	});

	it('refuses more written tags than a recipe keeps, counting each tag once', () => {
		expect(tagListSchema.safeParse(manyTags).error?.issues).toEqual([
			expect.objectContaining({
				path: [],
				message: `Use ${settings.recipeLimits.maxTagsPerRecipe} tags or fewer.`,
			}),
		]);
		expect(tagListSchema.safeParse([...manyTags.slice(1), 'TAG 1']).success).toBe(true);
	});

	it('reads stored tags past either limit', () => {
		const storedTagListSchema = tagListSchemaFor(storedContent);

		expect(storedTagListSchema.parse([...manyTags, longTag])).toEqual([...manyTags, longTag]);
	});
});
