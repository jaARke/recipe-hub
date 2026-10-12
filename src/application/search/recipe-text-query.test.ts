import { describe, expect, it } from 'vitest';
import { parseRecipeTextQuery } from '@/application/search/recipe-text-query';

function includedWords(text: string): string[] | undefined {
	return parseRecipeTextQuery(text)?.includedWords;
}

describe('parseRecipeTextQuery', () => {
	it('returns nothing for blank text', () => {
		expect(parseRecipeTextQuery('')).toBeUndefined();
		expect(parseRecipeTextQuery(' \t\n ')).toBeUndefined();
	});

	it('keeps the text as typed, trimmed, and includes each word', () => {
		expect(parseRecipeTextQuery('  chicken   SOUP ')).toEqual({
			text: 'chicken   SOUP',
			includedWords: ['chicken', 'SOUP'],
			excludedTerms: [],
		});
	});

	it('includes the words of a quoted phrase', () => {
		expect(includedWords('"pot roast" carrots')).toEqual(['pot', 'roast', 'carrots']);
	});

	it('reads curly quotes as phrase quotes', () => {
		expect(parseRecipeTextQuery('“pot roast” -„bay leaf‟')).toEqual({
			text: '"pot roast" -"bay leaf"',
			includedWords: ['pot', 'roast'],
			excludedTerms: ['"bay leaf"'],
		});
	});

	it('leaves out or between terms, in any case', () => {
		expect(includedWords('soup or stew OR "pot roast" Or chili')).toEqual([
			'soup',
			'stew',
			'pot',
			'roast',
			'chili',
		]);
	});

	it('keeps or as a word at the edges and inside words', () => {
		expect(includedWords('or soup')).toEqual(['or', 'soup']);
		expect(includedWords('soup or')).toEqual(['soup', 'or']);
		expect(includedWords('oregano or-orzo')).toEqual(['oregano', 'or', 'orzo']);
	});

	it('excludes the word or quoted phrase after a dash, as written', () => {
		expect(parseRecipeTextQuery('soup -onion -"bay leaf" -Sugar-free or -celery')).toEqual({
			text: 'soup -onion -"bay leaf" -Sugar-free or -celery',
			includedWords: ['soup'],
			excludedTerms: ['onion', '"bay leaf"', 'Sugar-free', 'celery'],
		});
	});

	it('keeps a dash inside a word', () => {
		expect(parseRecipeTextQuery('sugar-free cookies')).toEqual({
			text: 'sugar-free cookies',
			includedWords: ['sugar', 'free', 'cookies'],
			excludedTerms: [],
		});
	});

	it('excludes the term after a lone dash and ignores a dash with nothing after it', () => {
		expect(parseRecipeTextQuery('soup - onion -')).toEqual({
			text: 'soup - onion -',
			includedWords: ['soup'],
			excludedTerms: ['onion'],
		});
		expect(parseRecipeTextQuery('-')).toEqual({ text: '-', includedWords: [], excludedTerms: [] });
	});

	it('cancels a doubled dash', () => {
		expect(parseRecipeTextQuery('--onion')).toEqual({
			text: '--onion',
			includedWords: ['onion'],
			excludedTerms: [],
		});
	});

	it('ignores stray punctuation and drops exclusions without letters or numbers', () => {
		expect(parseRecipeTextQuery('salt, pepper! (thyme) & <sage> -... -!')).toEqual({
			text: 'salt, pepper! (thyme) & <sage> -... -!',
			includedWords: ['salt', 'pepper', 'thyme', 'sage'],
			excludedTerms: [],
		});
	});

	it('runs an unclosed phrase to the end of the text', () => {
		expect(parseRecipeTextQuery('soup -"bay leaf')).toEqual({
			text: 'soup -"bay leaf',
			includedWords: ['soup'],
			excludedTerms: ['"bay leaf"'],
		});
		expect(parseRecipeTextQuery('soup -""')?.excludedTerms).toEqual([]);
		expect(parseRecipeTextQuery('"')).toEqual({ text: '"', includedWords: [], excludedTerms: [] });
	});

	it('keeps accented words whole, composing decomposed accents', () => {
		expect(parseRecipeTextQuery('crème brûlée -jalapeño')).toEqual({
			text: 'crème brûlée -jalapeño',
			includedWords: ['crème', 'brûlée'],
			excludedTerms: ['jalapeño'],
		});
		expect(includedWords('crème')).toEqual(['crème']);
	});
});
