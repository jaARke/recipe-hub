import { describe, expect, it } from 'vitest';
import { formatAmount } from '@/domain/recipe/amount-format';
import type { IngredientLine } from '@/domain/recipe/ingredient';
import { parseIngredientLine } from '@/domain/recipe/ingredient-parser';
import { scaleIngredientLine } from '@/domain/recipe/ingredient-scaling';

type ScaledParts = Omit<IngredientLine, 'text'>;

describe('scaleIngredientLine', () => {
	it.each<[string, number, ScaledParts]>([
		['⅓ cup sugar', 1 / 2, { amount: { min: 2.5 }, unit: 'tablespoons', item: 'sugar' }],
		['¾ cup butter', 1 / 2, { amount: { min: 6 }, unit: 'tablespoons', item: 'butter' }],
		[
			'1 tablespoon baking powder',
			1 / 2,
			{ amount: { min: 1.5 }, unit: 'teaspoons', item: 'baking powder' },
		],
		['1 teaspoon salt', 3, { amount: { min: 1 }, unit: 'tablespoon', item: 'salt' }],
		['2¼ teaspoons yeast', 2, { amount: { min: 1.5 }, unit: 'tablespoons', item: 'yeast' }],
		['1 cup buttermilk', 5 / 6, { amount: { min: 0.75 }, unit: 'cup', item: 'buttermilk' }],
		['4 tablespoons butter', 2, { amount: { min: 0.5 }, unit: 'cup', item: 'butter' }],
		[
			'14 ounces condensed milk',
			2,
			{ amount: { min: 28 }, unit: 'ounces', item: 'condensed milk' },
		],
		['½ pound sausage', 2 / 3, { amount: { min: 5.25 }, unit: 'ounces', item: 'sausage' }],
		['2 to 3 carrots', 1 / 2, { amount: { min: 1, max: 1.5 }, item: 'carrots' }],
		['1-2 tbsp oil', 2, { amount: { min: 2, max: 4 }, unit: 'tbsp', item: 'oil' }],
		[
			'1 can (14 ounces) coconut milk',
			2,
			{ amount: { min: 2 }, unit: 'cans (14 ounces)', item: 'coconut milk' },
		],
		['12 oz (340 g) chocolate', 2, { amount: { min: 24 }, unit: 'oz (680 g)', item: 'chocolate' }],
		[
			'2 cups plus 2 tablespoons flour',
			2,
			{ amount: { min: 4 }, unit: 'cups', item: 'plus 4 tablespoons flour' },
		],
		['1 lb 2 oz beef', 2, { amount: { min: 2 }, unit: 'lb', item: '4 oz beef' }],
		['⅛ teaspoon cayenne', 1 / 4, { amount: { min: 0.125 }, unit: 'teaspoon', item: 'cayenne' }],
		['500 g flour', 1 / 3, { amount: { min: 165 }, unit: 'g', item: 'flour' }],
		['1.5 kg potatoes', 1 / 2, { amount: { min: 0.75 }, unit: 'kg', item: 'potatoes' }],
		['1 c. milk', 1 / 2, { amount: { min: 0.5 }, unit: 'c.', item: 'milk' }],
		['1 onion', 2, { amount: { min: 2 }, item: 'onions' }],
		['1 large onion', 3, { amount: { min: 3 }, item: 'large onions' }],
		['2 eggs', 1 / 2, { amount: { min: 1 }, item: 'egg' }],
		[
			'1 boneless, skinless chicken breast',
			2,
			{ amount: { min: 2 }, item: 'boneless, skinless chicken breast' },
		],
		['1 clove garlic', 2, { amount: { min: 2 }, unit: 'cloves', item: 'garlic' }],
	])('scales "%s" by %s', (text, factor, parts) => {
		expect(scaleIngredientLine(parseIngredientLine(text), factor)).toStrictEqual({
			line: { text, ...parts },
		});
	});

	it.each<[string, number, ScaledParts]>([
		['1 teaspoon salt', 1.5, { amount: { min: 1.5 }, unit: 'teaspoons', item: 'salt' }],
		['½ teaspoon vanilla', 3, { amount: { min: 1.5 }, unit: 'teaspoons', item: 'vanilla' }],
		['1 teaspoon salt', 6, { amount: { min: 2 }, unit: 'tablespoons', item: 'salt' }],
	])('takes a larger unit for "%s" by %s only where it reads easily', (text, factor, parts) => {
		expect(scaleIngredientLine(parseIngredientLine(text), factor)).toStrictEqual({
			line: { text, ...parts },
		});
	});

	it.each<[string, number, ScaledParts]>([
		['40 g butter', 1 / 3, { amount: { min: 13 }, unit: 'g', item: 'butter' }],
		['2.5 g yeast', 3, { amount: { min: 8 }, unit: 'g', item: 'yeast' }],
		['330 ml milk', 1 / 2, { amount: { min: 165 }, unit: 'ml', item: 'milk' }],
		['250 ml stock', 1 / 3, { amount: { min: 83 }, unit: 'ml', item: 'stock' }],
		['1.1 kg potatoes', 2 / 3, { amount: { min: 0.75 }, unit: 'kg', item: 'potatoes' }],
	])('rounds the metric amount in "%s" by %s to its step', (text, factor, parts) => {
		expect(scaleIngredientLine(parseIngredientLine(text), factor)).toStrictEqual({
			line: { text, ...parts },
		});
	});

	it.each([
		['1.1 kg potatoes', 2 / 3, '0.75'],
		['500 g flour', 1 / 3, '165'],
		['2.5 g yeast', 1, '2.5'],
		['1½ kg potatoes', 1, '1.5'],
		['166.67 g sugar', 1, '166.67'],
	])('writes the amount in "%s" by %s as %s', (text, factor, expected) => {
		const { line } = scaleIngredientLine(parseIngredientLine(text), factor);
		expect(line.amount === undefined ? undefined : formatAmount(line.amount, line.unit)).toBe(
			expected
		);
	});

	it.each<[string, number, ScaledParts]>([
		['two eggs', 2, { amount: { min: 4 }, item: 'eggs' }],
		['one and a half cups flour', 2, { amount: { min: 3 }, unit: 'cups', item: 'flour' }],
		['one-half cup sugar', 2, { amount: { min: 1 }, unit: 'cup', item: 'sugar' }],
		['half a cup milk', 2, { amount: { min: 1 }, unit: 'cup', item: 'milk' }],
		['a dozen eggs', 2, { amount: { min: 2 }, unit: 'dozen', item: 'eggs' }],
		[
			'two to three cloves garlic',
			2,
			{ amount: { min: 4, max: 6 }, unit: 'cloves', item: 'garlic' },
		],
		['three or four apples', 2, { amount: { min: 6, max: 8 }, item: 'apples' }],
		['a pinch of salt', 2, { amount: { min: 2 }, unit: 'pinches', item: 'salt' }],
		['1 and 1/2 cups flour', 2, { amount: { min: 3 }, unit: 'cups', item: 'flour' }],
		['about 2 cups flour', 2, { amount: { min: 4 }, unit: 'cups', item: 'flour' }],
	])('scales "%s", whose amount is in words or an everyday form, by %s', (text, factor, parts) => {
		expect(scaleIngredientLine(parseIngredientLine(text), factor)).toStrictEqual({
			line: { text, ...parts },
		});
	});

	it.each<[string, number, ScaledParts]>([
		[
			'2 heaping tablespoons cocoa',
			2,
			{ amount: { min: 0.25 }, unit: 'heaping cup', item: 'cocoa' },
		],
		[
			'2 level tablespoons salt',
			1 / 2,
			{ amount: { min: 1 }, unit: 'level tablespoon', item: 'salt' },
		],
		['1 scant cup flour', 2, { amount: { min: 2 }, unit: 'scant cups', item: 'flour' }],
	])('keeps the describing word before the unit in "%s" by %s', (text, factor, parts) => {
		expect(scaleIngredientLine(parseIngredientLine(text), factor)).toStrictEqual({
			line: { text, ...parts },
		});
	});

	it.each(['Salt to taste', 'half-and-half'])(
		'leaves "%s", with nothing to scale, unchanged and unmarked',
		(text) => {
			const line = parseIngredientLine(text);
			expect(scaleIngredientLine(line, 2)).toStrictEqual({ line });
		}
	);

	it.each(['a few sprigs thyme', 'a little olive oil', 'a couple of carrots', 'an onion'])(
		'marks "%s", which opens with an amount it cannot read, with the original',
		(text) => {
			expect(scaleIngredientLine(parseIngredientLine(text), 2)).toStrictEqual({
				line: { text, item: text },
				asWritten: text,
			});
		}
	);

	it('scales what it read in "1 egg plus 1 yolk" and shows the original', () => {
		expect(scaleIngredientLine(parseIngredientLine('1 egg plus 1 yolk'), 2)).toStrictEqual({
			line: { text: '1 egg plus 1 yolk', amount: { min: 2 }, item: 'egg plus 1 yolk' },
			asWritten: '1 egg plus 1 yolk',
		});
	});

	it.each([
		'1 sheet puff pastry, thawed',
		'⅓ cup sugar',
		'1 can (14 ounces) coconut milk',
		'2.5 g yeast',
		'1½ kg potatoes',
		'Salt to taste',
	])('leaves "%s" as it is at the original scale', (text) => {
		const line = parseIngredientLine(text);
		expect(scaleIngredientLine(line, 1)).toStrictEqual({ line });
	});

	it.each<[string, number, ScaledParts]>([
		['1 lb 2 oz beef', 1 / 3, { amount: { min: 6 }, unit: 'ounces', item: 'beef' }],
		[
			'¼ cup plus 2 tablespoons sugar',
			1 / 2,
			{ amount: { min: 3 }, unit: 'tablespoons', item: 'sugar' },
		],
	])('adds the parts of "%s" when the scale moves them to one unit', (text, factor, parts) => {
		expect(scaleIngredientLine(parseIngredientLine(text), factor)).toStrictEqual({
			line: { text, ...parts },
		});
	});

	it.each<[string, number, ScaledParts]>([
		[
			'1 cup (240 ml, warm) milk, divided',
			1 / 2,
			{ amount: { min: 0.5 }, unit: 'cup (120 ml, warm)', item: 'milk', preparation: 'divided' },
		],
		[
			'2 cans (15 ounces each) chickpeas, drained',
			2,
			{
				amount: { min: 4 },
				unit: 'cans (15 ounces each)',
				item: 'chickpeas',
				preparation: 'drained',
			},
		],
		[
			'1 pound carrots, cut into 2-inch pieces',
			2,
			{
				amount: { min: 2 },
				unit: 'pounds',
				item: 'carrots',
				preparation: 'cut into 2-inch pieces',
			},
		],
		['1 to 2 eggs', 1 / 2, { amount: { min: 0.5, max: 1 }, item: 'egg' }],
		['2 Cups flour', 1 / 2, { amount: { min: 1 }, unit: 'Cup', item: 'flour' }],
		['2 cups flour', 1 / 2, { amount: { min: 1 }, unit: 'cup', item: 'flour' }],
	])('scales "%s" by %s without a mark', (text, factor, parts) => {
		expect(scaleIngredientLine(parseIngredientLine(text), factor)).toStrictEqual({
			line: { text, ...parts },
		});
	});

	it.each<[string, number, ScaledParts]>([
		['1 lb 2-inch beef cubes', 2, { amount: { min: 2 }, unit: 'lb', item: '2-inch beef cubes' }],
	])('leaves the length that opens the item in "%s" as written', (text, factor, parts) => {
		expect(scaleIngredientLine(parseIngredientLine(text), factor)).toStrictEqual({
			line: { text, ...parts },
		});
	});

	it.each<[string, number, ScaledParts]>([
		[
			'1 cup (1-1/2 ounces) flour',
			2,
			{ amount: { min: 2 }, unit: 'cups (3 ounces)', item: 'flour' },
		],
		[
			'1 cup plus 1-1/2 tablespoons flour',
			2,
			{ amount: { min: 2 }, unit: 'cups', item: 'plus 3 tablespoons flour' },
		],
		[
			'1 cup (2-3/4 ounces) cheese',
			2,
			{ amount: { min: 2 }, unit: 'cups (5½ ounces)', item: 'cheese' },
		],
		[
			'1 cup (1-2 ounces) cheese',
			2,
			{ amount: { min: 2 }, unit: 'cups (2 to 4 ounces)', item: 'cheese' },
		],
	])('reads the hyphenated amount in "%s" as the parser does', (text, factor, parts) => {
		expect(scaleIngredientLine(parseIngredientLine(text), factor)).toStrictEqual({
			line: { text, ...parts },
		});
	});

	it.each<[string, number, ScaledParts]>([
		[
			'1 whole chicken, about 4 pounds',
			2,
			{ amount: { min: 2 }, item: 'whole chickens', preparation: 'about 4 pounds' },
		],
		['7 eggs plus one egg yolk', 2, { amount: { min: 14 }, item: 'eggs plus one egg yolk' }],
		[
			'1 cup plus a quarter cup flour',
			2,
			{ amount: { min: 2 }, unit: 'cups', item: 'plus a quarter cup flour' },
		],
		[
			'1 cup plus one-half cup flour',
			2,
			{ amount: { min: 2 }, unit: 'cups', item: 'plus one-half cup flour' },
		],
		['Juice of 1 lemon', 2, { item: 'Juice of 1 lemon' }],
	])('marks "%s", whose unread text holds a number, with the original', (text, factor, parts) => {
		expect(scaleIngredientLine(parseIngredientLine(text), factor)).toStrictEqual({
			line: { text, ...parts },
			asWritten: text,
		});
	});
});
