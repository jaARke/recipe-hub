import { describe, expect, it } from 'vitest';
import {
	hasMatch,
	plainText,
	toHighlightedText,
	toSnippet,
} from '@/infrastructure/db/search-headline';

// ts_headline's output with its start and stop marks written as [[ and ]].
function headline(text: string): string {
	return text.replaceAll('[[', '\u0002').replaceAll(']]', '\u0003');
}

describe('toHighlightedText', () => {
	it('splits marked matches into highlighted segments', () => {
		expect(toHighlightedText(headline('[[Crème]] [[brûlée]] with a crackly top'))).toEqual([
			{ text: 'Crème', highlighted: true },
			{ text: ' ', highlighted: false },
			{ text: 'brûlée', highlighted: true },
			{ text: ' with a crackly top', highlighted: false },
		]);
	});

	it('keeps tag-like text as text', () => {
		expect(toHighlightedText(headline('Skillet <b>[[scones]]</b>'))).toEqual([
			{ text: 'Skillet <b>', highlighted: false },
			{ text: 'scones', highlighted: true },
			{ text: '</b>', highlighted: false },
		]);
	});

	it('returns text without marks as one plain segment', () => {
		expect(toHighlightedText('Tomato soup')).toEqual(plainText('Tomato soup'));
	});
});

describe('hasMatch', () => {
	it('tells whether a headline marks a match', () => {
		expect(hasMatch(headline('A [[custard]] with burnt sugar'))).toBe(true);
		expect(hasMatch('A custard with burnt sugar')).toBe(false);
	});
});

describe('toSnippet', () => {
	const text =
		'Heat the oven. Stir in the buttermilk with a fork until a dough forms. Bake until golden.';

	it('adds no ellipsis when the fragment covers the whole text', () => {
		expect(toSnippet(headline(text.replace('fork', '[[fork]]')), text)).toEqual([
			{ text: 'Heat the oven. Stir in the buttermilk with a ', highlighted: false },
			{ text: 'fork', highlighted: true },
			{ text: ' until a dough forms. Bake until golden.', highlighted: false },
		]);
	});

	it('marks a fragment that starts and ends inside the text', () => {
		expect(toSnippet(headline('buttermilk with a [[fork]] until a dough'), text)).toEqual([
			{ text: '… buttermilk with a ', highlighted: false },
			{ text: 'fork', highlighted: true },
			{ text: ' until a dough …', highlighted: false },
		]);
	});

	it('ignores punctuation that ts_headline drops from the ends', () => {
		expect(toSnippet(headline('dough forms. Bake until [[golden]]'), text)).toEqual([
			{ text: '… dough forms. Bake until ', highlighted: false },
			{ text: 'golden', highlighted: true },
		]);
	});

	it('checks the first and last of several fragments', () => {
		expect(toSnippet(headline('Heat the [[oven]] … Bake until [[golden]]'), text)).toEqual([
			{ text: 'Heat the ', highlighted: false },
			{ text: 'oven', highlighted: true },
			{ text: ' … Bake until ', highlighted: false },
			{ text: 'golden', highlighted: true },
		]);
	});

	it('marks a fragment cut inside a hyphenated word', () => {
		expect(toSnippet(headline('inch [[pan]]'), 'Use a 9-inch pan')).toEqual([
			{ text: '… inch ', highlighted: false },
			{ text: 'pan', highlighted: true },
		]);
	});
});
