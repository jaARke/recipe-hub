import { describe, expect, it } from 'vitest';
import { normalizeTagLabel, tagKey, uniqueTagLabels } from '@/domain/recipe/tag-normalization';

describe('normalizeTagLabel', () => {
	it('trims and collapses internal whitespace', () => {
		expect(normalizeTagLabel('  Make   ahead ')).toBe('Make ahead');
		expect(normalizeTagLabel('Freezer\tfriendly\n')).toBe('Freezer friendly');
	});

	it('keeps the case as written', () => {
		expect(normalizeTagLabel('BBQ')).toBe('BBQ');
	});

	it('strips control characters as every text field does, NUL included', () => {
		expect(normalizeTagLabel('Bak\0ing')).toBe('Baking');
		expect(normalizeTagLabel('\u0001 Slow \u0002cooked\u007F ')).toBe('Slow cooked');
	});

	it('composes accents', () => {
		expect(normalizeTagLabel('Français')).toBe('Français');
	});
});

describe('tagKey', () => {
	it('matches labels that differ only in case or spacing', () => {
		expect(tagKey(' make  AHEAD')).toBe(tagKey('Make ahead'));
	});

	it('matches composed and decomposed accents', () => {
		expect(tagKey('Café')).toBe(tagKey('Café'));
	});

	it('matches a label with control characters to the label without them', () => {
		expect(tagKey('Bak\0ing')).toBe(tagKey('Baking'));
	});

	it('tells different tags apart', () => {
		expect(tagKey('Soup')).not.toBe(tagKey('Soups'));
	});
});

describe('uniqueTagLabels', () => {
	it('drops repeats by key, so the first spelling wins', () => {
		expect(uniqueTagLabels(['Make ahead', 'Soup', 'make  AHEAD', 'So\0up'])).toEqual([
			'Make ahead',
			'Soup',
		]);
	});
});
