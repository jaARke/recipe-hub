import { describe, expect, it } from 'vitest';
import type { IngredientLine } from '@/domain/recipe/ingredient';
import {
	exampleIngredientLine,
	maxReadLineLength,
	parseAmountText,
	parseIngredientLine,
	preparationSeparator,
} from '@/domain/recipe/ingredient-parser';
import { sampleRecipeContents } from '@/domain/recipe/samples/sample-recipes';

type ParsedParts = Omit<IngredientLine, 'text'>;

const sampleLines = sampleRecipeContents.flatMap((content) =>
	content.ingredientSections.flatMap((section) => section.lines)
);

describe('parseIngredientLine', () => {
	it.each(sampleLines.map((line) => [line.text, line]))(
		'reads the sample line "%s" as stored',
		(text, line) => {
			expect(parseIngredientLine(text)).toStrictEqual(line);
		}
	);

	it.each<[string, ParsedParts]>([
		['½ cup sugar', { amount: { min: 0.5 }, unit: 'cup', item: 'sugar' }],
		['⅓ cup honey', { amount: { min: 1 / 3 }, unit: 'cup', item: 'honey' }],
		['2½ cups flour', { amount: { min: 2.5 }, unit: 'cups', item: 'flour' }],
		['2 1/2 cups flour', { amount: { min: 2.5 }, unit: 'cups', item: 'flour' }],
		['2 ½ cups flour', { amount: { min: 2.5 }, unit: 'cups', item: 'flour' }],
		['1 1⁄2 cups milk', { amount: { min: 1.5 }, unit: 'cups', item: 'milk' }],
		['1.5 cups rice', { amount: { min: 1.5 }, unit: 'cups', item: 'rice' }],
		['.5 tsp salt', { amount: { min: 0.5 }, unit: 'tsp', item: 'salt' }],
	])('reads the quantity in "%s"', (text, parts) => {
		expect(parseIngredientLine(text)).toStrictEqual({ text, ...parts });
	});

	it.each<[string, ParsedParts]>([
		['1-2 cups milk', { amount: { min: 1, max: 2 }, unit: 'cups', item: 'milk' }],
		['1–2 tbsp oil', { amount: { min: 1, max: 2 }, unit: 'tbsp', item: 'oil' }],
		['1 to 2 cups milk', { amount: { min: 1, max: 2 }, unit: 'cups', item: 'milk' }],
		['1 or 2 eggs', { amount: { min: 1, max: 2 }, item: 'eggs' }],
		['1½-2 cups stock', { amount: { min: 1.5, max: 2 }, unit: 'cups', item: 'stock' }],
		['1/2-1 tsp salt', { amount: { min: 0.5, max: 1 }, unit: 'tsp', item: 'salt' }],
	])('reads the range in "%s"', (text, parts) => {
		expect(parseIngredientLine(text)).toStrictEqual({ text, ...parts });
	});

	it.each<[string, ParsedParts]>([
		['1-1/2 cups milk', { amount: { min: 1.5 }, unit: 'cups', item: 'milk' }],
		['2–3/4 cups sugar', { amount: { min: 2.75 }, unit: 'cups', item: 'sugar' }],
	])('reads the hyphenated mixed number in "%s"', (text, parts) => {
		expect(parseIngredientLine(text)).toStrictEqual({ text, ...parts });
	});

	it.each<[string, ParsedParts]>([
		['1 tbsp oil', { amount: { min: 1 }, unit: 'tbsp', item: 'oil' }],
		['1 T oil', { amount: { min: 1 }, unit: 'T', item: 'oil' }],
		['1 t salt', { amount: { min: 1 }, unit: 't', item: 'salt' }],
		['1 tsp salt', { amount: { min: 1 }, unit: 'tsp', item: 'salt' }],
		['1 c. milk', { amount: { min: 1 }, unit: 'c.', item: 'milk' }],
		['8 oz cheese', { amount: { min: 8 }, unit: 'oz', item: 'cheese' }],
		['2 lb ground beef', { amount: { min: 2 }, unit: 'lb', item: 'ground beef' }],
		['500 g flour', { amount: { min: 500 }, unit: 'g', item: 'flour' }],
		['250 ml water', { amount: { min: 250 }, unit: 'ml', item: 'water' }],
		['100g flour', { amount: { min: 100 }, unit: 'g', item: 'flour' }],
		['1 sheet puff pastry', { amount: { min: 1 }, unit: 'sheet', item: 'puff pastry' }],
	])('keeps the unit in "%s" as written', (text, parts) => {
		expect(parseIngredientLine(text)).toStrictEqual({ text, ...parts });
	});

	it.each<[string, ParsedParts]>([
		[
			'1½ tbls crushed anise Seed',
			{ amount: { min: 1.5 }, unit: 'tbls', item: 'crushed anise Seed' },
		],
		['½ teas soda', { amount: { min: 0.5 }, unit: 'teas', item: 'soda' }],
		['¼ tea sp. salt', { amount: { min: 0.25 }, unit: 'tea sp.', item: 'salt' }],
		['6 tsps. chili powder', { amount: { min: 6 }, unit: 'tsps.', item: 'chili powder' }],
		['1 cupful flour', { amount: { min: 1 }, unit: 'cupful', item: 'flour' }],
		['3 sq. bitter chocolate', { amount: { min: 3 }, unit: 'sq.', item: 'bitter chocolate' }],
		['1 pk green tomatoes', { amount: { min: 1 }, unit: 'pk', item: 'green tomatoes' }],
		['2 level tablespoons salt', { amount: { min: 2 }, unit: 'level tablespoons', item: 'salt' }],
		['1 tbs oil', { amount: { min: 1 }, unit: 'tbs', item: 'oil' }],
		['1 Tbs. oil', { amount: { min: 1 }, unit: 'Tbs.', item: 'oil' }],
		['2 tbsps butter', { amount: { min: 2 }, unit: 'tbsps', item: 'butter' }],
		['1 T. butter', { amount: { min: 1 }, unit: 'T.', item: 'butter' }],
		['1 t. salt', { amount: { min: 1 }, unit: 't.', item: 'salt' }],
		['8 fl. oz. milk', { amount: { min: 8 }, unit: 'fl. oz.', item: 'milk' }],
		['8 fl oz. milk', { amount: { min: 8 }, unit: 'fl oz.', item: 'milk' }],
		['4 cl rum', { amount: { min: 4 }, unit: 'cl', item: 'rum' }],
		['1 litre stock', { amount: { min: 1 }, unit: 'litre', item: 'stock' }],
	])('reads the old or abbreviated unit in "%s"', (text, parts) => {
		expect(parseIngredientLine(text)).toStrictEqual({ text, ...parts });
	});

	it.each<[string, ParsedParts]>([
		['1 envelope gelatin', { amount: { min: 1 }, unit: 'envelope', item: 'gelatin' }],
		['2 envelopes gelatin', { amount: { min: 2 }, unit: 'envelopes', item: 'gelatin' }],
		['1 env. gelatin', { amount: { min: 1 }, unit: 'env.', item: 'gelatin' }],
		['1 packet yeast', { amount: { min: 1 }, unit: 'packet', item: 'yeast' }],
		['2 packets yeast', { amount: { min: 2 }, unit: 'packets', item: 'yeast' }],
		['1 pkt. yeast', { amount: { min: 1 }, unit: 'pkt.', item: 'yeast' }],
		['1 package cream cheese', { amount: { min: 1 }, unit: 'package', item: 'cream cheese' }],
		['2 packages cream cheese', { amount: { min: 2 }, unit: 'packages', item: 'cream cheese' }],
		['1 pkg. cream cheese', { amount: { min: 1 }, unit: 'pkg.', item: 'cream cheese' }],
		['1 jar salsa', { amount: { min: 1 }, unit: 'jar', item: 'salsa' }],
		['2 jars salsa', { amount: { min: 2 }, unit: 'jars', item: 'salsa' }],
		['1 can tomatoes', { amount: { min: 1 }, unit: 'can', item: 'tomatoes' }],
		['2 cans tomatoes', { amount: { min: 2 }, unit: 'cans', item: 'tomatoes' }],
		['1 stick butter', { amount: { min: 1 }, unit: 'stick', item: 'butter' }],
		['2 sticks butter', { amount: { min: 2 }, unit: 'sticks', item: 'butter' }],
		['1 slice bread', { amount: { min: 1 }, unit: 'slice', item: 'bread' }],
		['4 slices bacon', { amount: { min: 4 }, unit: 'slices', item: 'bacon' }],
		['1 strip lemon peel', { amount: { min: 1 }, unit: 'strip', item: 'lemon peel' }],
		['2 strips bacon', { amount: { min: 2 }, unit: 'strips', item: 'bacon' }],
		['1 stalk celery', { amount: { min: 1 }, unit: 'stalk', item: 'celery' }],
		['2 stalks celery', { amount: { min: 2 }, unit: 'stalks', item: 'celery' }],
		['1 rib celery', { amount: { min: 1 }, unit: 'rib', item: 'celery' }],
		['2 ribs celery', { amount: { min: 2 }, unit: 'ribs', item: 'celery' }],
		['1 loaf bread', { amount: { min: 1 }, unit: 'loaf', item: 'bread' }],
		['2 loaves bread', { amount: { min: 2 }, unit: 'loaves', item: 'bread' }],
		['1 handful spinach', { amount: { min: 1 }, unit: 'handful', item: 'spinach' }],
		['2 handfuls spinach', { amount: { min: 2 }, unit: 'handfuls', item: 'spinach' }],
		['1 knob butter', { amount: { min: 1 }, unit: 'knob', item: 'butter' }],
		['2 knobs ginger', { amount: { min: 2 }, unit: 'knobs', item: 'ginger' }],
		['1 clove garlic', { amount: { min: 1 }, unit: 'clove', item: 'garlic' }],
		['2 cloves garlic', { amount: { min: 2 }, unit: 'cloves', item: 'garlic' }],
		['1 head lettuce', { amount: { min: 1 }, unit: 'head', item: 'lettuce' }],
		['2 heads lettuce', { amount: { min: 2 }, unit: 'heads', item: 'lettuce' }],
		['1 bunch cilantro', { amount: { min: 1 }, unit: 'bunch', item: 'cilantro' }],
		['2 bunches cilantro', { amount: { min: 2 }, unit: 'bunches', item: 'cilantro' }],
		['1 sprig rosemary', { amount: { min: 1 }, unit: 'sprig', item: 'rosemary' }],
		['3 sprigs thyme', { amount: { min: 3 }, unit: 'sprigs', item: 'thyme' }],
		['1 dash bitters', { amount: { min: 1 }, unit: 'dash', item: 'bitters' }],
		['2 dashes bitters', { amount: { min: 2 }, unit: 'dashes', item: 'bitters' }],
		['1 pinch salt', { amount: { min: 1 }, unit: 'pinch', item: 'salt' }],
		['2 pinches salt', { amount: { min: 2 }, unit: 'pinches', item: 'salt' }],
		['1 drop vanilla', { amount: { min: 1 }, unit: 'drop', item: 'vanilla' }],
		['3 drops vanilla', { amount: { min: 3 }, unit: 'drops', item: 'vanilla' }],
	])('reads the container or count unit in "%s"', (text, parts) => {
		expect(parseIngredientLine(text)).toStrictEqual({ text, ...parts });
	});

	it.each<[string, ParsedParts]>([
		[
			'1 can (14 ounces) coconut milk',
			{ amount: { min: 1 }, unit: 'can (14 ounces)', item: 'coconut milk' },
		],
		[
			'12 oz (340 g) dark chocolate, chopped',
			{ amount: { min: 12 }, unit: 'oz (340 g)', item: 'dark chocolate', preparation: 'chopped' },
		],
		// Before the unit, the size reads as part of the item, which renders the line as written.
		['1 (14-ounce) can tomatoes', { amount: { min: 1 }, item: '(14-ounce) can tomatoes' }],
	])('reads the size in parentheses in "%s"', (text, parts) => {
		expect(parseIngredientLine(text)).toStrictEqual({ text, ...parts });
	});

	it.each<[string, ParsedParts]>([
		['1 onion, diced', { amount: { min: 1 }, item: 'onion', preparation: 'diced' }],
		['2 large eggs, beaten', { amount: { min: 2 }, item: 'large eggs', preparation: 'beaten' }],
		[
			'1 cup (240 ml, warm) milk, divided',
			{ amount: { min: 1 }, unit: 'cup (240 ml, warm)', item: 'milk', preparation: 'divided' },
		],
		['1 cup of sugar', { amount: { min: 1 }, unit: 'cup', item: 'sugar' }],
		['2 of the eggs', { amount: { min: 2 }, item: 'of the eggs' }],
	])('splits the item and preparation in "%s"', (text, parts) => {
		expect(parseIngredientLine(text)).toStrictEqual({ text, ...parts });
	});

	it.each<[string, ParsedParts]>([
		[
			'12 oz boneless, skinless chicken breast, cut into thin strips',
			{
				amount: { min: 12 },
				unit: 'oz',
				item: 'boneless, skinless chicken breast',
				preparation: 'cut into thin strips',
			},
		],
		[
			'1 boneless, skinless chicken breast',
			{ amount: { min: 1 }, item: 'boneless, skinless chicken breast' },
		],
		[
			'4 bone-in, skin-on chicken thighs',
			{ amount: { min: 4 }, item: 'bone-in, skin-on chicken thighs' },
		],
		[
			'2 large, ripe avocados, diced',
			{ amount: { min: 2 }, item: 'large, ripe avocados', preparation: 'diced' },
		],
	])('keeps the comma in the run of describing words in "%s" in the item', (text, parts) => {
		expect(parseIngredientLine(text)).toStrictEqual({ text, ...parts });
	});

	it.each<[string, ParsedParts]>([
		[
			'1 cup half-and-half, warmed',
			{ amount: { min: 1 }, unit: 'cup', item: 'half-and-half', preparation: 'warmed' },
		],
		[
			'2 cups all-purpose, sifted',
			{ amount: { min: 2 }, unit: 'cups', item: 'all-purpose', preparation: 'sifted' },
		],
		[
			'1 cup raisins, chopped dates or figs',
			{ amount: { min: 1 }, unit: 'cup', item: 'raisins', preparation: 'chopped dates or figs' },
		],
	])('splits at the comma after a word that names the item in "%s"', (text, parts) => {
		expect(parseIngredientLine(text)).toStrictEqual({ text, ...parts });
	});

	it.each<[string, ParsedParts]>([
		['salt and pepper to taste', { item: 'salt and pepper', preparation: 'to taste' }],
		['Fresh parsley, for garnish', { item: 'Fresh parsley', preparation: 'for garnish' }],
		[
			'6 tablespoons sugar for the tops',
			{ amount: { min: 6 }, unit: 'tablespoons', item: 'sugar', preparation: 'for the tops' },
		],
		[
			'1 cup walnuts optional, chopped',
			{ amount: { min: 1 }, unit: 'cup', item: 'walnuts', preparation: 'optional, chopped' },
		],
		[
			'2 cups flour, plus more for dusting',
			{ amount: { min: 2 }, unit: 'cups', item: 'flour', preparation: 'plus more for dusting' },
		],
	])('moves the closing note in "%s" to the preparation', (text, parts) => {
		expect(parseIngredientLine(text)).toStrictEqual({ text, ...parts });
	});

	it.each([
		'a pinch of salt',
		'Juice of 1 lemon',
		'2-inch piece ginger',
		'1 1/2-inch piece ginger',
		'1,5 kg potatoes',
		'1/0 cup sugar',
		'0 cups sugar',
		'3-1 cups milk',
		'1-1/2-inch piece ginger',
		'1e3 g flour',
	])('reads no amount in "%s" and keeps the line as its item', (text) => {
		expect(parseIngredientLine(text)).toStrictEqual({ text, item: text });
	});

	it('tidies the spacing and keeps the words and their case as written', () => {
		expect(parseIngredientLine(' 2\u00a0Cups \t Flour ')).toStrictEqual({
			text: '2 Cups Flour',
			amount: { min: 2 },
			unit: 'Cups',
			item: 'Flour',
		});
	});

	it.each<[string, IngredientLine]>([
		['2 cups flour;', { text: '2 cups flour', amount: { min: 2 }, unit: 'cups', item: 'flour' }],
		['2 cups flour,', { text: '2 cups flour', amount: { min: 2 }, unit: 'cups', item: 'flour' }],
		['2 cups flour.', { text: '2 cups flour', amount: { min: 2 }, unit: 'cups', item: 'flour' }],
		['2 cups flour ;.', { text: '2 cups flour', amount: { min: 2 }, unit: 'cups', item: 'flour' }],
		['• 2 eggs', { text: '2 eggs', amount: { min: 2 }, item: 'eggs' }],
		['1. 2 eggs', { text: '2 eggs', amount: { min: 2 }, item: 'eggs' }],
		['▢ 1 cup milk,', { text: '1 cup milk', amount: { min: 1 }, unit: 'cup', item: 'milk' }],
		['Salt to taste;', { text: 'Salt to taste', item: 'Salt', preparation: 'to taste' }],
		['Juice of 1 lemon.', { text: 'Juice of 1 lemon', item: 'Juice of 1 lemon' }],
		['2 cups.', { text: '2 cups', item: '2 cups' }],
		['1 tsp. salt.', { text: '1 tsp. salt', amount: { min: 1 }, unit: 'tsp.', item: 'salt' }],
	])('stores %j without its list marker or closing punctuation', (text, line) => {
		expect(parseIngredientLine(text)).toStrictEqual(line);
	});

	it.each([
		['1/4 tsp.', '1/4 tsp.'],
		['1/4 tsp.;', '1/4 tsp.'],
		['1 T.', '1 T.'],
		['2 lbs.,', '2 lbs.'],
	])('keeps the period of the unit that ends %j', (text, kept) => {
		expect(parseIngredientLine(text)).toStrictEqual({ text: kept, item: kept });
	});

	it.each([
		['2 eggs [?];', { text: '2 eggs [?]', amount: { min: 2 }, item: 'eggs [?]' }],
		[
			'• [illegible] cups flour',
			{ text: '[illegible] cups flour', item: '[illegible] cups flour' },
		],
	])('keeps the transcription marker in %j', (text, line) => {
		expect(parseIngredientLine(text)).toStrictEqual(line);
	});

	it('reads the example line the import asks for into all four parts', () => {
		expect(parseIngredientLine(exampleIngredientLine)).toStrictEqual({
			text: exampleIngredientLine,
			amount: expect.anything(),
			unit: expect.any(String),
			item: expect.any(String),
			preparation: expect.any(String),
		});
	});

	it('leaves a line longer than it reads unread', () => {
		const text = '1-'.repeat(maxReadLineLength * 20);
		const started = performance.now();

		expect(parseIngredientLine(text)).toStrictEqual({ text, item: text });
		expect(performance.now() - started).toBeLessThan(100);
	});

	it('keeps a line whose item would be empty as written', () => {
		expect(parseIngredientLine('1 cup, sifted')).toStrictEqual({
			text: '1 cup, sifted',
			item: '1 cup, sifted',
		});
	});

	it.each(['1/4 tsp', '2 cups', '1 fl oz', '3 tbsp.'])(
		'keeps "%s", a unit with no item, as written',
		(text) => {
			expect(parseIngredientLine(text)).toStrictEqual({ text, item: text });
		}
	);
});

describe('preparationSeparator', () => {
	it.each([
		['6 tablespoons sugar for the tops', ' '],
		['1 onion, diced', ', '],
		['1 cup walnuts optional, chopped', ' '],
		['2 cups flour, plus more for dusting', ', '],
	])('reads what "%s" writes before its preparation', (text, separator) => {
		expect(preparationSeparator(parseIngredientLine(text))).toBe(separator);
	});

	it('writes a comma before a preparation the text does not end with', () => {
		expect(
			preparationSeparator({
				text: '1 onion, diced',
				amount: { min: 1 },
				item: 'onion',
				preparation: 'chopped',
			})
		).toBe(', ');
	});
});

describe('parseAmountText', () => {
	it.each([
		['4', { min: 4 }],
		[' 6 ', { min: 6 }],
		['4 to 6', { min: 4, max: 6 }],
		['4-6', { min: 4, max: 6 }],
		['1½', { min: 1.5 }],
	])('reads "%s"', (text, amount) => {
		expect(parseAmountText(text)).toStrictEqual(amount);
	});

	it.each(['', 'about 4', '4 servings', '0', '6 to 4', '1,5'])(
		'reads no amount in "%s"',
		(text) => {
			expect(parseAmountText(text)).toBeUndefined();
		}
	);
});
