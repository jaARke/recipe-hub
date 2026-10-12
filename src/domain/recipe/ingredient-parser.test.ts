import { describe, expect, it } from 'vitest';
import type { IngredientLine } from '@/domain/recipe/ingredient';
import { maxIngredientLineLength } from '@/domain/recipe/ingredient-limits';
import { parseAmountText, parseIngredientLine } from '@/domain/recipe/ingredient-parser';
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

	it('trims the text and keeps it otherwise as written', () => {
		expect(parseIngredientLine('  2 Cups  Flour ')).toStrictEqual({
			text: '2 Cups  Flour',
			amount: { min: 2 },
			unit: 'Cups',
			item: 'Flour',
		});
	});

	it('leaves a line longer than the limit unread', () => {
		const text = '1-'.repeat(maxIngredientLineLength * 20);
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
