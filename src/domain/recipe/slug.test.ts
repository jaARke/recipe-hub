import { describe, expect, it } from 'vitest';
import { slugCandidate, slugify, slugKey, slugSchema } from '@/domain/recipe/slug';

const slugCap = 60;

describe('slugKey', () => {
	it('folds text as a slug does, without a cap or a fallback', () => {
		const words = 'make-ahead family dinner for a crowd with leftovers to spare at Thanksgiving';
		expect(slugKey(words)).toBe(
			'make-ahead-family-dinner-for-a-crowd-with-leftovers-to-spare-at-thanksgiving'
		);
		expect(slugKey('St. Patrick’s Day')).toBe('st-patricks-day');
		expect(slugKey('¡!')).toBe('');
	});
});

describe('slugify', () => {
	it('lowercases and hyphenates words', () => {
		expect(slugify('Buttermilk biscuits')).toBe('buttermilk-biscuits');
	});

	it('folds diacritics and Latin ligatures to ASCII', () => {
		expect(slugify('Crème brûlée')).toBe('creme-brulee');
		expect(slugify('Käsespätzle')).toBe('kasespatzle');
		expect(slugify('Bœuf bourguignon')).toBe('boeuf-bourguignon');
		expect(slugify('Smørrebrød')).toBe('smorrebrod');
	});

	it('turns runs of punctuation and spaces into one hyphen and trims the ends', () => {
		expect(slugify('  Pot roast -- (Sunday!)  ')).toBe('pot-roast-sunday');
		expect(slugify('Mac & cheese, 2 ways')).toBe('mac-cheese-2-ways');
	});

	it('drops apostrophes inside words', () => {
		expect(slugify("Grandma's lemon pie")).toBe('grandmas-lemon-pie');
		expect(slugify('June\u2019s biscuits')).toBe('junes-biscuits');
	});

	it('falls back when nothing is left', () => {
		expect(slugify('')).toBe('recipe');
		expect(slugify('!!!')).toBe('recipe');
		expect(slugify('麻婆豆腐')).toBe('recipe');
	});

	it('caps long titles at a word boundary', () => {
		const title =
			'Lemon icebox pie with a graham cracker crust and whipped cream, as made every summer';
		const slug = slugify(title);

		expect(slug.length).toBeLessThanOrEqual(slugCap);
		expect(slug).toBe('lemon-icebox-pie-with-a-graham-cracker-crust-and-whipped');
	});

	it('cuts a single overlong word at the cap', () => {
		expect(slugify('a'.repeat(80))).toBe('a'.repeat(slugCap));
	});

	it('produces slugs the slug schema accepts', () => {
		for (const title of ['Crème brûlée', '  -- Odd -- ', '麻婆豆腐', 'x'.repeat(80)]) {
			expect(slugSchema.safeParse(slugify(title)).success).toBe(true);
		}
	});
});

describe('slugCandidate', () => {
	it('uses the base for the first attempt', () => {
		expect(slugCandidate('chicken-soup', 1)).toBe('chicken-soup');
	});

	it('numbers later attempts', () => {
		expect(slugCandidate('chicken-soup', 2)).toBe('chicken-soup-2');
		expect(slugCandidate('recipe', 12)).toBe('recipe-12');
	});

	it('shortens a base at the cap to a word boundary to fit the number', () => {
		const base = 'lemon-icebox-pie-with-a-graham-cracker-crust-and-whipped-top';

		expect(base).toHaveLength(slugCap);
		expect(slugCandidate(base, 12)).toBe(
			'lemon-icebox-pie-with-a-graham-cracker-crust-and-whipped-12'
		);
	});

	it('cuts a single-word base at the cap to fit the number', () => {
		expect(slugCandidate('a'.repeat(slugCap), 12)).toBe(`${'a'.repeat(slugCap - 3)}-12`);
	});

	it.each([0, -1, 1.5])('rejects attempt %s', (attempt) => {
		expect(() => slugCandidate('soup', attempt)).toThrow(RangeError);
	});
});

describe('slugSchema', () => {
	it.each(['', 'Soup', 'soup--stew', '-soup', 'soup-', 'soupe à l’oignon'])(
		'rejects "%s"',
		(slug) => {
			expect(slugSchema.safeParse(slug).success).toBe(false);
		}
	);
});
