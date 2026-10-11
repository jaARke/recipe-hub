import { describe, expect, it } from 'vitest';
import { normalizeTagLabel, tagKey, tagLabelSchema, tagListSchema } from '@/domain/recipe/tag';

describe('normalizeTagLabel', () => {
	it('trims and collapses internal whitespace', () => {
		expect(normalizeTagLabel('  Make   ahead ')).toBe('Make ahead');
		expect(normalizeTagLabel('Freezer\tfriendly\n')).toBe('Freezer friendly');
	});

	it('keeps the case as written', () => {
		expect(normalizeTagLabel('BBQ')).toBe('BBQ');
	});
});

describe('tagKey', () => {
	it('matches labels that differ only in case or spacing', () => {
		expect(tagKey(' make  AHEAD')).toBe(tagKey('Make ahead'));
	});

	it('matches composed and decomposed accents', () => {
		expect(tagKey('Cafe\u0301')).toBe(tagKey('Caf\u00e9'));
	});

	it('tells different tags apart', () => {
		expect(tagKey('Soup')).not.toBe(tagKey('Soups'));
	});
});

describe('tagLabelSchema', () => {
	it('normalizes the label', () => {
		expect(tagLabelSchema.parse('  Slow   cooked ')).toBe('Slow cooked');
	});

	it('rejects a blank label', () => {
		expect(tagLabelSchema.safeParse(' \t ').success).toBe(false);
	});
});

describe('tagListSchema', () => {
	it('drops repeats so the first spelling wins', () => {
		expect(
			tagListSchema.parse(['Baking', ' baking ', 'Make  ahead', 'BAKING', 'make ahead'])
		).toEqual(['Baking', 'Make ahead']);
	});
});
