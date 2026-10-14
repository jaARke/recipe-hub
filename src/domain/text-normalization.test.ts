import { describe, expect, it } from 'vitest';
import { normalizeText, withoutTrailingPunctuation } from '@/domain/text-normalization';

describe('normalizeText', () => {
	it.each([
		['Stir.\r\nThen rest.', 'Stir.\nThen rest.'],
		['Stir.\rThen rest.', 'Stir.\nThen rest.'],
		['2 cups  flour', '2 cups flour'],
		['2\tcups \t flour', '2 cups flour'],
		['2 cups flour', '2 cups flour'],
		['Mix well.  \nBake.', 'Mix well.\nBake.'],
		['Mix well.\n\t Bake.', 'Mix well.\nBake.'],
		['  Mix well. ', 'Mix well.'],
		['Mix.\n\nBake.', 'Mix.\n\nBake.'],
		['Mix. \r\n \r\n Bake.', 'Mix.\n\nBake.'],
	])('tidies the spacing of %j', (text, normalized) => {
		expect(normalizeText(text)).toBe(normalized);
	});

	it('keeps transcription markers and the words around them', () => {
		expect(normalizeText('1  [illegible]  cups flour [?] ')).toBe('1 [illegible] cups flour [?]');
	});

	it('keeps case and words as written', () => {
		expect(normalizeText('1 T  Sugar')).toBe('1 T Sugar');
	});

	it('collapses a long run of spaces in linear time', () => {
		const text = `a${' '.repeat(1_000_000)}b`;
		const started = performance.now();

		expect(normalizeText(text)).toBe('a b');
		expect(performance.now() - started).toBeLessThan(100);
	});
});

describe('withoutTrailingPunctuation', () => {
	it.each([
		['Salt;', 'Salt'],
		['Salt ; ,', 'Salt'],
		['For the glaze:', 'For the glaze'],
		['Salt', 'Salt'],
		[';', ''],
		['Salt?', 'Salt?'],
		['2 cups flour [?]', '2 cups flour [?]'],
	])('drops the punctuation that ends %j', (text, kept) => {
		expect(withoutTrailingPunctuation(text, ';,:')).toBe(kept);
	});

	it('reads a long run that stops short of the end in linear time', () => {
		const text = `${';'.repeat(1_000_000)}x`;
		const started = performance.now();

		expect(withoutTrailingPunctuation(text, ';')).toBe(text);
		expect(performance.now() - started).toBeLessThan(100);
	});
});
