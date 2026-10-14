import { describe, expect, it } from 'vitest';
import { hasNoNul, headingTextSchema, nonEmptyTextSchema } from '@/domain/text';

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

	it('keeps line breaks inside the text, without the spaces and tabs at their ends', () => {
		expect(nonEmptyTextSchema.parse('Stir. \r\n\tThen  rest.')).toBe('Stir.\nThen rest.');
	});

	it('rejects text of only control characters as blank', () => {
		const result = nonEmptyTextSchema.safeParse('\0\u0002\u007F');
		expect(result.error?.issues.map((issue) => issue.message)).toEqual(['Enter some text.']);
	});

	it('rejects blank text', () => {
		expect(nonEmptyTextSchema.safeParse(' \t\n ').success).toBe(false);
	});
});

describe('headingTextSchema', () => {
	it.each([
		['For the glaze:', 'For the glaze'],
		['Grandma Rose’s pie;', 'Grandma Rose’s pie'],
		[' For the crust , ', 'For the crust'],
		['For the  filling :', 'For the filling'],
	])('drops the separators that end %j', (text, heading) => {
		expect(headingTextSchema.parse(text)).toBe(heading);
	});

	it.each(['Is it done?', 'Pie [?]', 'Pie [illegible]', 'Pie...', 'Mrs. Lee’s pie.'])(
		'keeps %j as written',
		(text) => {
			expect(headingTextSchema.parse(text)).toBe(text);
		}
	);

	it('keeps separators that are all the text holds, so it is never left blank', () => {
		expect(headingTextSchema.parse(' : ')).toBe(':');
	});

	it('rejects blank text once, as plain text does', () => {
		const result = headingTextSchema.safeParse(' ');
		expect(result.error?.issues.map((issue) => issue.message)).toEqual(['Enter some text.']);
	});
});

describe('hasNoNul', () => {
	it('tells text with a NUL apart', () => {
		expect(hasNoNul('soup')).toBe(true);
		expect(hasNoNul('soup\0')).toBe(false);
	});
});
