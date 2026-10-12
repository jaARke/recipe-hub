import { describe, expect, it } from 'vitest';
import { hasNoNul, nonEmptyTextSchema } from '@/domain/text';

describe('nonEmptyTextSchema', () => {
	it('trims the text', () => {
		expect(nonEmptyTextSchema.parse('  Grandma Rose ')).toBe('Grandma Rose');
	});

	it('strips NUL, which Postgres cannot store, rather than refusing it', () => {
		expect(nonEmptyTextSchema.parse('Grandpa\0Lou')).toBe('GrandpaLou');
	});

	it('strips a search highlight marker', () => {
		expect(nonEmptyTextSchema.parse('Tomato \u0002basil\u0003 soup')).toBe('Tomato basil soup');
	});

	it('strips every C0 control and DEL before trimming', () => {
		expect(nonEmptyTextSchema.parse('\u0001 Soup \u001F\u007F')).toBe('Soup');
	});

	it('composes accents, so a decomposed spelling is stored like a composed one', () => {
		expect(nonEmptyTextSchema.parse('Crème brûlée')).toBe('Crème brûlée');
	});

	it('keeps tabs and line breaks inside the text', () => {
		expect(nonEmptyTextSchema.parse('Stir.\r\n\tThen rest.')).toBe('Stir.\r\n\tThen rest.');
	});

	it('rejects text of only control characters as blank', () => {
		const result = nonEmptyTextSchema.safeParse('\0\u0002\u007F');
		expect(result.error?.issues.map((issue) => issue.message)).toEqual(['Enter some text.']);
	});

	it('rejects blank text', () => {
		expect(nonEmptyTextSchema.safeParse(' \t\n ').success).toBe(false);
	});
});

describe('hasNoNul', () => {
	it('tells text with a NUL apart', () => {
		expect(hasNoNul('soup')).toBe(true);
		expect(hasNoNul('soup\0')).toBe(false);
	});
});
