import { describe, expect, it } from 'vitest';
import { formatAmount } from '@/domain/recipe/amount-format';
import type { IngredientLine, IngredientLineSpan } from '@/domain/recipe/ingredient';
import { parseIngredientLine } from '@/domain/recipe/ingredient-parser';
import { givesAmount, scaleIngredientLine } from '@/domain/recipe/ingredient-scaling';

type ScaledParts = Omit<IngredientLine, 'text'>;

describe('givesAmount', () => {
	it.each([
		'Add 2 cups flour',
		'Beat in two eggs',
		'Stir in the remaining ½ cup sugar',
		'Juice of 1 lemon',
		'a few sprigs thyme',
		// A cup's "C." before a lowercase word, which no sentence ends with.
		'Add 12 C. flour',
	])('finds an amount in "%s"', (text) => {
		expect(givesAmount(text)).toBe(true);
	});

	it.each([
		'Bake at 350 F for 20 minutes',
		'Heat the oven to 300°F.',
		'Heat the water to between 105 and 115 F',
		'Let it rise for 1 to 2 hours',
		'Half an hour later, stir',
		'Sift the flour 2 times',
		'See Note 2',
		'Cut into 2-inch pieces',
		'Whisk in the flour.',
		'Bake at 180 C.',
		'Bake at 180C. Cool on a rack.',
		'Heat the milk to 40.5 C',
		'Heat the milk to between 40.5 and 45.5 C.',
		'Heat the milk to 105.5 F.',
		'Heat the milk to 40.5°C.',
		'Heat the milk to 105.5 degrees.',
		'Separate ½ of the eggs',
		'Fold in a third of the whites',
		'Half of the eggs go into the dough',
		'Separate one of every two eggs',
	])('finds no amount in "%s", whose numbers are right at any scale', (text) => {
		expect(givesAmount(text)).toBe(false);
	});
});

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
		['1 to 2 teaspoons salt', 2, { amount: { min: 2, max: 4 }, unit: 'teaspoons', item: 'salt' }],
		[
			'1 to 2 teaspoons salt',
			1 / 2,
			{ amount: { min: 0.5, max: 1 }, unit: 'teaspoon', item: 'salt' },
		],
		['1 to 3 tablespoons oil', 2, { amount: { min: 2, max: 6 }, unit: 'tablespoons', item: 'oil' }],
		[
			'1 to 3 tablespoons oil',
			1 / 2,
			{ amount: { min: 0.5, max: 1.5 }, unit: 'tablespoons', item: 'oil' },
		],
		['¼ to ½ cup sugar', 2, { amount: { min: 0.5, max: 1 }, unit: 'cup', item: 'sugar' }],
		['¼ to ½ cup sugar', 1 / 2, { amount: { min: 2, max: 4 }, unit: 'tablespoons', item: 'sugar' }],
		[
			'2 tbsp sugar (or 1 to 2 tsp stevia)',
			2,
			{ amount: { min: 0.25 }, unit: 'cup', item: 'sugar (or 2 to 4 tsp stevia)' },
		],
		[
			'2 tbsp sugar (or 1 to 2 tsp stevia)',
			1 / 2,
			{ amount: { min: 1 }, unit: 'tbsp', item: 'sugar (or ½ to 1 tsp stevia)' },
		],
		[
			'1 cup milk, plus 1 to 3 tablespoons',
			2,
			{ amount: { min: 2 }, unit: 'cups', item: 'milk', preparation: 'plus 2 to 6 tablespoons' },
		],
		[
			'1 cup milk, plus 1 to 3 tablespoons',
			1 / 2,
			{
				amount: { min: 0.5 },
				unit: 'cup',
				item: 'milk',
				preparation: 'plus ½ to 1½ tablespoons',
			},
		],
		['1 to 2 pounds beef', 2, { amount: { min: 2, max: 4 }, unit: 'pounds', item: 'beef' }],
		['1 to 2 pounds beef', 1 / 2, { amount: { min: 0.5, max: 1 }, unit: 'pound', item: 'beef' }],
		['¼ to ½ pound bacon', 2, { amount: { min: 0.5, max: 1 }, unit: 'pound', item: 'bacon' }],
		['¼ to ½ pound bacon', 1 / 2, { amount: { min: 2, max: 4 }, unit: 'ounces', item: 'bacon' }],
		['1 to 2 ounces cheese', 2, { amount: { min: 2, max: 4 }, unit: 'ounces', item: 'cheese' }],
		[
			'1 to 2 ounces cheese',
			1 / 2,
			{ amount: { min: 0.5, max: 1 }, unit: 'ounce', item: 'cheese' },
		],
		[
			'1 to 2 fl oz lime juice',
			2,
			{ amount: { min: 2, max: 4 }, unit: 'fl oz', item: 'lime juice' },
		],
		[
			'1 to 2 fl oz lime juice',
			1 / 2,
			{ amount: { min: 0.5, max: 1 }, unit: 'fl oz', item: 'lime juice' },
		],
		['1 to 2 sticks butter', 2, { amount: { min: 2, max: 4 }, unit: 'sticks', item: 'butter' }],
		[
			'1 to 2 sticks butter',
			1 / 2,
			{ amount: { min: 0.5, max: 1 }, unit: 'stick', item: 'butter' },
		],
		['100 to 200 g flour', 2, { amount: { min: 200, max: 400 }, unit: 'g', item: 'flour' }],
		['100 to 200 g flour', 1 / 2, { amount: { min: 50, max: 100 }, unit: 'g', item: 'flour' }],
		['250 to 500 ml stock', 2, { amount: { min: 500, max: 1000 }, unit: 'ml', item: 'stock' }],
		['250 to 500 ml stock', 1 / 2, { amount: { min: 125, max: 250 }, unit: 'ml', item: 'stock' }],
		['1 to 1.5 kg potatoes', 2, { amount: { min: 2, max: 3 }, unit: 'kg', item: 'potatoes' }],
		[
			'1 to 1.5 kg potatoes',
			1 / 2,
			{ amount: { min: 0.5, max: 0.75 }, unit: 'kg', item: 'potatoes' },
		],
		['1 to 2 cans tomatoes', 2, { amount: { min: 2, max: 4 }, unit: 'cans', item: 'tomatoes' }],
		[
			'1 to 2 cans tomatoes',
			1 / 2,
			{ amount: { min: 0.5, max: 1 }, unit: 'can', item: 'tomatoes' },
		],
		[
			'1 pound pasta (about 6 to 8 cups cooked)',
			2,
			{ amount: { min: 2 }, unit: 'pounds', item: 'pasta (about 12 to 16 cups cooked)' },
		],
		[
			'1 pound pasta (about 6 to 8 cups cooked)',
			1 / 2,
			{ amount: { min: 0.5 }, unit: 'pound', item: 'pasta (about 3 to 4 cups cooked)' },
		],
	])(
		'keeps the range in "%s" a range, in a unit that reads both its ends close, by %s',
		(text, factor, parts) => {
			expect(scaleIngredientLine(parseIngredientLine(text), factor)).toStrictEqual({
				line: { text, ...parts },
			});
		}
	);

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
		['1.5 [?] kg flour', 1, '1.5'],
		['0.25 [?] kg sugar', 2, '0.5'],
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

	it.each<[string, number, ScaledParts]>([
		['1/3 [?] cup flour', 2, { amount: { min: 2 / 3 }, unit: '[?] cup', item: 'flour' }],
		['1 [?] cup (240 ml) milk', 2, { amount: { min: 2 }, unit: '[?] cups (480 ml)', item: 'milk' }],
		['3 [?] tsp vanilla', 3, { amount: { min: 3 }, unit: '[?] tablespoons', item: 'vanilla' }],
	])('keeps the transcription marker before the unit in "%s" by %s', (text, factor, parts) => {
		expect(scaleIngredientLine(parseIngredientLine(text), factor)).toStrictEqual({
			line: { text, ...parts },
		});
	});

	it.each([
		'Salt to taste',
		'half-and-half',
		'Half and half',
		'half & half',
		'Oil for frying (350 F)',
	])('leaves "%s", with nothing to scale, unchanged and unmarked', (text) => {
		const line = parseIngredientLine(text);
		expect(scaleIngredientLine(line, 2)).toStrictEqual({ line });
	});

	it.each([
		'a few sprigs thyme',
		'a little olive oil',
		'a couple of carrots',
		'an onion',
		'half a lemon',
		'Juice of 1 lemon',
		'Zest of one lemon',
		'twelve to fifteen apples',
	])('marks the whole of "%s", which gives an amount it read none of, as unscaled', (text) => {
		expect(scaleIngredientLine(parseIngredientLine(text), 2)).toStrictEqual({
			line: { text, item: text },
			unscaled: 'whole',
		});
	});

	it.each(['12 to fifteen apples', '2 or more eggs', '1 cup to 1 1/2 cups milk'])(
		'leaves "%s", a range whose end it cannot read, as written and marks the whole unscaled',
		(text) => {
			expect(scaleIngredientLine(parseIngredientLine(text), 2)).toStrictEqual({
				line: { text, item: text },
				unscaled: 'whole',
			});
		}
	);

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
		['1 egg plus 1 yolk', 2, { amount: { min: 2 }, item: 'eggs plus 2 yolks' }],
		['1 egg plus 1 yolk', 1 / 2, { amount: { min: 0.5 }, item: 'egg plus ½ yolk' }],
		['1 egg + 1 yolk', 2, { amount: { min: 2 }, item: 'eggs + 2 yolks' }],
		['7 eggs plus one egg yolk', 2, { amount: { min: 14 }, item: 'eggs plus 2 egg yolks' }],
		['7 eggs plus one egg yolk', 1 / 2, { amount: { min: 3.5 }, item: 'eggs plus ½ egg yolk' }],
		[
			'2 eggs plus one, beaten',
			2,
			{ amount: { min: 4 }, item: 'eggs plus 2', preparation: 'beaten' },
		],
		[
			'2 eggs plus one, beaten',
			1 / 2,
			{ amount: { min: 1 }, item: 'egg plus ½', preparation: 'beaten' },
		],
		[
			'3 eggs, plus 1 egg white',
			2,
			{ amount: { min: 6 }, item: 'eggs', preparation: 'plus 2 egg whites' },
		],
		['2 limes plus a half lime', 2, { amount: { min: 4 }, item: 'limes plus 1 lime' }],
		['2 limes plus a half lime', 1 / 2, { amount: { min: 1 }, item: 'lime plus ¼ lime' }],
		['2 tomatoes or 1 can', 2, { amount: { min: 4 }, item: 'tomatoes or 2 cans' }],
		['2 tomatoes or 1 can', 1 / 2, { amount: { min: 1 }, item: 'tomato or ½ can' }],
		[
			'3 medium plum tomatoes, finely chopped or 1 (14-ounce can) chopped tomatoes',
			2,
			{
				amount: { min: 6 },
				item: 'medium plum tomatoes',
				preparation: 'finely chopped or 2 (14-ounce cans) chopped tomatoes',
			},
		],
		[
			'3 medium plum tomatoes, finely chopped or 1 (14-ounce can) chopped tomatoes',
			1 / 2,
			{
				amount: { min: 1.5 },
				item: 'medium plum tomatoes',
				preparation: 'finely chopped or ½ (14-ounce can) chopped tomatoes',
			},
		],
		[
			'1 cup plus a quarter cup flour',
			2,
			{ amount: { min: 2 }, unit: 'cups', item: 'plus ½ cup flour' },
		],
		[
			'1 cup plus a quarter cup flour',
			1 / 2,
			{ amount: { min: 0.5 }, unit: 'cup', item: 'plus 2 tablespoons flour' },
		],
		[
			'1 cup plus one-half cup flour',
			2,
			{ amount: { min: 2 }, unit: 'cups', item: 'plus 1 cup flour' },
		],
		[
			'1 cup flour plus a tablespoon',
			2,
			{ amount: { min: 2 }, unit: 'cups', item: 'flour plus 2 tablespoons' },
		],
		[
			'1 cup flour plus a tablespoon',
			1 / 2,
			{ amount: { min: 0.5 }, unit: 'cup', item: 'flour plus 1½ teaspoons' },
		],
		[
			'1 cup flour plus half a lemon',
			2,
			{ amount: { min: 2 }, unit: 'cups', item: 'flour plus 1 lemon' },
		],
		[
			'1 Tbsp fresh basil, rinsed, dried, and chopped (or 1 tsp dried)',
			2,
			{
				amount: { min: 2 },
				unit: 'Tbsp',
				item: 'fresh basil',
				preparation: 'rinsed, dried, and chopped (or 2 tsp dried)',
			},
		],
		[
			'1 Tbsp fresh basil, rinsed, dried, and chopped (or 1 tsp dried)',
			1 / 2,
			{
				amount: { min: 1.5 },
				unit: 'teaspoons',
				item: 'fresh basil',
				preparation: 'rinsed, dried, and chopped (or ½ tsp dried)',
			},
		],
	])(
		'scales the amount a word joins to the line’s in "%s" by %s, its words agreeing',
		(text, factor, parts) => {
			expect(scaleIngredientLine(parseIngredientLine(text), factor)).toStrictEqual({
				line: { text, ...parts },
			});
		}
	);

	it.each<[string, number, ScaledParts]>([
		[
			'1 cup flour plus one to 2 tablespoons',
			2,
			{ amount: { min: 2 }, unit: 'cups', item: 'flour plus 2 to 4 tablespoons' },
		],
		[
			'1 cup flour plus one to 2 tablespoons',
			1 / 2,
			{ amount: { min: 0.5 }, unit: 'cup', item: 'flour plus 1½ to 3 teaspoons' },
		],
		[
			'1 cup flour plus 1 to two tablespoons',
			2,
			{ amount: { min: 2 }, unit: 'cups', item: 'flour plus 2 to 4 tablespoons' },
		],
		[
			'1 cup flour plus 1 to two tablespoons',
			1 / 2,
			{ amount: { min: 0.5 }, unit: 'cup', item: 'flour plus 1½ to 3 teaspoons' },
		],
		[
			'1 cup flour plus 1 to 2 tablespoons',
			2,
			{ amount: { min: 2 }, unit: 'cups', item: 'flour plus 2 to 4 tablespoons' },
		],
		[
			'1 cup flour plus 1 to 2 tablespoons',
			1 / 2,
			{ amount: { min: 0.5 }, unit: 'cup', item: 'flour plus 1½ to 3 teaspoons' },
		],
		[
			'1 cup flour plus 1-2 tablespoons',
			2,
			{ amount: { min: 2 }, unit: 'cups', item: 'flour plus 2 to 4 tablespoons' },
		],
		[
			'1 cup flour plus 1-2 tablespoons',
			1 / 2,
			{ amount: { min: 0.5 }, unit: 'cup', item: 'flour plus 1½ to 3 teaspoons' },
		],
		[
			'1 cup flour plus 1 or 2 tablespoons',
			2,
			{ amount: { min: 2 }, unit: 'cups', item: 'flour plus 2 to 4 tablespoons' },
		],
		[
			'1 cup flour plus 1 or 2 tablespoons',
			1 / 2,
			{ amount: { min: 0.5 }, unit: 'cup', item: 'flour plus 1½ to 3 teaspoons' },
		],
		[
			'1 cup flour plus one or two tablespoons',
			2,
			{ amount: { min: 2 }, unit: 'cups', item: 'flour plus 2 to 4 tablespoons' },
		],
		[
			'1 cup flour plus one or two tablespoons',
			1 / 2,
			{ amount: { min: 0.5 }, unit: 'cup', item: 'flour plus 1½ to 3 teaspoons' },
		],
		[
			'1 cup flour plus ½ to ¾ cup',
			2,
			{ amount: { min: 2 }, unit: 'cups', item: 'flour plus 1 to 1½ cups' },
		],
		[
			'1 cup flour plus ½ to ¾ cup',
			1 / 2,
			{ amount: { min: 0.5 }, unit: 'cup', item: 'flour plus 4 to 6 tablespoons' },
		],
		[
			'1 cup flour plus ½ to one tablespoon',
			2,
			{ amount: { min: 2 }, unit: 'cups', item: 'flour plus 1 to 2 tablespoons' },
		],
		[
			'1 cup flour plus ½ to one tablespoon',
			1 / 2,
			{ amount: { min: 0.5 }, unit: 'cup', item: 'flour plus ¾ to 1½ teaspoons' },
		],
		[
			'1 cup flour plus one to 1½ tablespoons',
			2,
			{ amount: { min: 2 }, unit: 'cups', item: 'flour plus 2 to 3 tablespoons' },
		],
		[
			'1 cup flour plus one to 1½ tablespoons',
			1 / 2,
			{ amount: { min: 0.5 }, unit: 'cup', item: 'flour plus 1½ to 2¼ teaspoons' },
		],
		[
			'1 cup flour plus 1 and 1/2 tablespoons',
			2,
			{ amount: { min: 2 }, unit: 'cups', item: 'flour plus 3 tablespoons' },
		],
		[
			'1 cup flour plus 1 and 1/2 tablespoons',
			1 / 2,
			{ amount: { min: 0.5 }, unit: 'cup', item: 'flour plus 2¼ teaspoons' },
		],
		[
			'1 cup flour, plus one to 2 tablespoons for dusting',
			2,
			{
				amount: { min: 2 },
				unit: 'cups',
				item: 'flour',
				preparation: 'plus 2 to 4 tablespoons for dusting',
			},
		],
		[
			'1 cup flour, plus one to 2 tablespoons for dusting',
			1 / 2,
			{
				amount: { min: 0.5 },
				unit: 'cup',
				item: 'flour',
				preparation: 'plus 1½ to 3 teaspoons for dusting',
			},
		],
		[
			'1 cup flour plus one to 2',
			2,
			{ amount: { min: 2 }, unit: 'cups', item: 'flour plus 2 to 4' },
		],
		[
			'1 cup flour plus one to 2',
			1 / 2,
			{ amount: { min: 0.5 }, unit: 'cup', item: 'flour plus ½ to 1' },
		],
		['2 eggs plus one to 2 yolks', 2, { amount: { min: 4 }, item: 'eggs plus 2 to 4 yolks' }],
		['2 eggs plus one to 2 yolks', 1 / 2, { amount: { min: 1 }, item: 'egg plus ½ to 1 yolk' }],
		[
			'1 cup chopped onion (one to 2 medium)',
			2,
			{ amount: { min: 2 }, unit: 'cups', item: 'chopped onion (2 to 4 medium)' },
		],
		[
			'1 cup chopped onion (one to 2 medium)',
			1 / 2,
			{ amount: { min: 0.5 }, unit: 'cup', item: 'chopped onion (½ to 1 medium)' },
		],
		[
			'1 cup chopped onion (between 1 and 2 medium)',
			2,
			{ amount: { min: 2 }, unit: 'cups', item: 'chopped onion (2 to 4 medium)' },
		],
		[
			'1 cup chopped onion (between 1 and 2 medium)',
			1 / 2,
			{ amount: { min: 0.5 }, unit: 'cup', item: 'chopped onion (½ to 1 medium)' },
		],
		[
			'1 pound pasta (between 6 and 8 cups cooked)',
			2,
			{ amount: { min: 2 }, unit: 'pounds', item: 'pasta (12 to 16 cups cooked)' },
		],
		[
			'1 pound pasta (between 6 and 8 cups cooked)',
			1 / 2,
			{ amount: { min: 0.5 }, unit: 'pound', item: 'pasta (3 to 4 cups cooked)' },
		],
	])('reads the range in "%s" whole and scales both its ends by %s', (text, factor, parts) => {
		expect(scaleIngredientLine(parseIngredientLine(text), factor)).toStrictEqual({
			line: { text, ...parts },
		});
	});

	it.each<[string, number, ScaledParts, IngredientLineSpan[]]>([
		[
			'1 cup flour plus two to 1 tablespoon',
			2,
			{ amount: { min: 2 }, unit: 'cups', item: 'flour plus two to 1 tablespoon' },
			[{ field: 'item', start: 11, end: 19 }],
		],
		[
			'1 cup flour plus two to 1 tablespoon',
			1 / 2,
			{ amount: { min: 0.5 }, unit: 'cup', item: 'flour plus two to 1 tablespoon' },
			[{ field: 'item', start: 11, end: 19 }],
		],
		[
			'1 cup flour plus one to 1/2 cup',
			2,
			{ amount: { min: 2 }, unit: 'cups', item: 'flour plus one to 1/2 cup' },
			[{ field: 'item', start: 11, end: 21 }],
		],
		[
			'1 cup flour plus one to 1/2 cup',
			1 / 2,
			{ amount: { min: 0.5 }, unit: 'cup', item: 'flour plus one to 1/2 cup' },
			[{ field: 'item', start: 11, end: 21 }],
		],
		[
			'1 cup flour plus 12 to fifteen tablespoons',
			2,
			{ amount: { min: 2 }, unit: 'cups', item: 'flour plus 12 to fifteen tablespoons' },
			[{ field: 'item', start: 11, end: 24 }],
		],
		[
			'1 cup flour plus 12 to fifteen tablespoons',
			1 / 2,
			{ amount: { min: 0.5 }, unit: 'cup', item: 'flour plus 12 to fifteen tablespoons' },
			[{ field: 'item', start: 11, end: 24 }],
		],
		[
			'2 eggs plus twelve to fifteen yolks',
			2,
			{ amount: { min: 4 }, item: 'eggs plus twelve to fifteen yolks' },
			[{ field: 'item', start: 10, end: 27 }],
		],
		[
			'2 eggs plus twelve to fifteen yolks',
			1 / 2,
			{ amount: { min: 1 }, item: 'egg plus twelve to fifteen yolks' },
			[{ field: 'item', start: 9, end: 26 }],
		],
		[
			'1 cup water plus a tablespoon or two',
			2,
			{ amount: { min: 2 }, unit: 'cups', item: 'water plus a tablespoon or two' },
			[{ field: 'item', start: 11, end: 30 }],
		],
		[
			'1 cup water plus a tablespoon or two',
			1 / 2,
			{ amount: { min: 0.5 }, unit: 'cup', item: 'water plus a tablespoon or two' },
			[{ field: 'item', start: 11, end: 30 }],
		],
		[
			'1 cup flour plus 2 tablespoons to 1',
			2,
			{ amount: { min: 2 }, unit: 'cups', item: 'flour plus 2 tablespoons to 1' },
			[{ field: 'item', start: 11, end: 29 }],
		],
		[
			'1 cup flour plus 2 tablespoons to 1',
			1 / 2,
			{ amount: { min: 0.5 }, unit: 'cup', item: 'flour plus 2 tablespoons to 1' },
			[{ field: 'item', start: 11, end: 29 }],
		],
		[
			'1 cup flour (a cup or two)',
			2,
			{ amount: { min: 2 }, unit: 'cups', item: 'flour (a cup or two)' },
			[{ field: 'item', start: 7, end: 19 }],
		],
		[
			'1 cup flour (a cup or two)',
			1 / 2,
			{ amount: { min: 0.5 }, unit: 'cup', item: 'flour (a cup or two)' },
			[{ field: 'item', start: 7, end: 19 }],
		],
	])(
		'leaves the range in "%s", which it cannot read, as written and marks it unscaled by %s',
		(text, factor, parts, amounts) => {
			expect(scaleIngredientLine(parseIngredientLine(text), factor)).toStrictEqual({
				line: { text, ...parts },
				unscaled: { amounts },
			});
		}
	);

	it.each<[string, number, ScaledParts]>([
		['2 eggs plus 1 or more yolks', 2, { amount: { min: 4 }, item: 'eggs plus 2 or more yolks' }],
		[
			'2 eggs plus 1 or more yolks',
			1 / 2,
			{ amount: { min: 1 }, item: 'egg plus ½ or more yolks' },
		],
		[
			'2 tablespoons butter, plus 1 to grease the pan',
			2,
			{
				amount: { min: 0.25 },
				unit: 'cup',
				item: 'butter',
				preparation: 'plus 2 to grease the pan',
			},
		],
		[
			'1 cup flour plus 1 tablespoon or 2 eggs',
			2,
			{ amount: { min: 2 }, unit: 'cups', item: 'flour plus 2 tablespoons or 4 eggs' },
		],
		[
			'1 cup flour plus 1 tablespoon or 2 eggs',
			1 / 2,
			{ amount: { min: 0.5 }, unit: 'cup', item: 'flour plus 1½ teaspoons or 1 egg' },
		],
		[
			'2 tablespoons butter, plus 1 to grease the pan',
			1 / 2,
			{
				amount: { min: 1 },
				unit: 'tablespoon',
				item: 'butter',
				preparation: 'plus ½ to grease the pan',
			},
		],
	])(
		'scales the count in "%s", whose "or" or "to" ends no range, by %s without a mark',
		(text, factor, parts) => {
			expect(scaleIngredientLine(parseIngredientLine(text), factor)).toStrictEqual({
				line: { text, ...parts },
			});
		}
	);

	it.each<[string, number, ScaledParts]>([
		[
			'8 ounces frozen or fresh green peas (about 1 ¾ cups, optional)',
			2,
			{
				amount: { min: 16 },
				unit: 'ounces',
				item: 'frozen or fresh green peas (about 3½ cups, optional)',
			},
		],
		[
			'8 ounces frozen or fresh green peas (about 1 ¾ cups, optional)',
			1 / 2,
			// ⅞ cup is no cup's step, and 14 tablespoons too many to measure, so it rounds to 1 cup.
			{
				amount: { min: 4 },
				unit: 'ounces',
				item: 'frozen or fresh green peas (about 1 cup, optional)',
			},
		],
		[
			'2½ cups sifted flour, sifted together with ½ cup cocoa powder',
			2,
			{
				amount: { min: 5 },
				unit: 'cups',
				item: 'sifted flour',
				preparation: 'sifted together with 1 cup cocoa powder',
			},
		],
		[
			'2½ cups sifted flour, sifted together with ½ cup cocoa powder',
			1 / 2,
			{
				amount: { min: 1.25 },
				unit: 'cups',
				item: 'sifted flour',
				preparation: 'sifted together with ¼ cup cocoa powder',
			},
		],
		[
			'1 cup seedless raisins boiled using ½ cup of the raisin water in cake',
			2,
			{
				amount: { min: 2 },
				unit: 'cups',
				item: 'seedless raisins boiled using 1 cup of the raisin water in cake',
			},
		],
		[
			'1 cup seedless raisins boiled using ½ cup of the raisin water in cake',
			1 / 2,
			{
				amount: { min: 0.5 },
				unit: 'cup',
				item: 'seedless raisins boiled using ¼ cup of the raisin water in cake',
			},
		],
		[
			'1 Tbsp garlic, minced (about 2–3 cloves)',
			2,
			{
				amount: { min: 2 },
				unit: 'Tbsp',
				item: 'garlic',
				preparation: 'minced (about 4 to 6 cloves)',
			},
		],
		[
			'1 Tbsp garlic, minced (about 2–3 cloves)',
			1 / 2,
			{
				amount: { min: 1.5 },
				unit: 'teaspoons',
				item: 'garlic',
				preparation: 'minced (about 1 to 1½ cloves)',
			},
		],
		[
			'6 cups stock, divided: 4 cups for the soup and 2 cups for the rice',
			1 / 2,
			{
				amount: { min: 3 },
				unit: 'cups',
				item: 'stock',
				preparation: 'divided: 2 cups for the soup and 1 cup for the rice',
			},
		],
		[
			'1 pound ground beef (or 2 cups cooked lentils)',
			2,
			{ amount: { min: 2 }, unit: 'pounds', item: 'ground beef (or 4 cups cooked lentils)' },
		],
		[
			'1 cup chopped onion (1 medium)',
			2,
			{ amount: { min: 2 }, unit: 'cups', item: 'chopped onion (2 medium)' },
		],
		[
			'1 cup chopped onion (1 medium)',
			1 / 2,
			{ amount: { min: 0.5 }, unit: 'cup', item: 'chopped onion (½ medium)' },
		],
		['8 oz. pasta (half a box)', 2, { amount: { min: 16 }, unit: 'oz.', item: 'pasta (1 box)' }],
		['8 oz. pasta (half a box)', 1 / 2, { amount: { min: 4 }, unit: 'oz.', item: 'pasta (¼ box)' }],
		[
			'1 cup chopped onion (about 2 onions)',
			2,
			{ amount: { min: 2 }, unit: 'cups', item: 'chopped onion (about 4 onions)' },
		],
		[
			'1 cup chopped onion (about 2 onions)',
			1 / 2,
			{ amount: { min: 0.5 }, unit: 'cup', item: 'chopped onion (about 1 onion)' },
		],
		// A C after one digit is a cup, as old cards write it.
		['2 sticks (1 C) butter', 2, { amount: { min: 4 }, unit: 'sticks (2 C)', item: 'butter' }],
		['2 sticks (1 C) butter', 1 / 2, { amount: { min: 1 }, unit: 'stick (½ C)', item: 'butter' }],
		[
			'1 cup flour (or 1 C whole wheat)',
			2,
			{ amount: { min: 2 }, unit: 'cups', item: 'flour (or 2 C whole wheat)' },
		],
		[
			'1 cup flour (or 1 C whole wheat)',
			1 / 2,
			{ amount: { min: 0.5 }, unit: 'cup', item: 'flour (or ½ C whole wheat)' },
		],
		[
			'1 cup flour (or 1.5 C whole wheat)',
			2,
			{ amount: { min: 2 }, unit: 'cups', item: 'flour (or 3 C whole wheat)' },
		],
		[
			'1 cup flour (or 1.5 C whole wheat)',
			1 / 2,
			{ amount: { min: 0.5 }, unit: 'cup', item: 'flour (or ¾ C whole wheat)' },
		],
		// A rate's base scales with the amount before it, so the rate holds.
		[
			'1 tablespoon salt for every 2 cups water',
			2,
			{ amount: { min: 2 }, unit: 'tablespoons', item: 'salt for every 4 cups water' },
		],
		[
			'1 tablespoon salt for every 2 cups water',
			1 / 2,
			{ amount: { min: 1.5 }, unit: 'teaspoons', item: 'salt for every 1 cup water' },
		],
	])(
		'scales the second amount or the equivalent in "%s", measured by volume or weight, by %s',
		(text, factor, parts) => {
			expect(scaleIngredientLine(parseIngredientLine(text), factor)).toStrictEqual({
				line: { text, ...parts },
			});
		}
	);

	it.each<[string, number, ScaledParts]>([
		[
			'2½ sticks (10 oz.) butter, softened',
			2,
			{ amount: { min: 5 }, unit: 'sticks (20 oz.)', item: 'butter', preparation: 'softened' },
		],
		[
			'2½ sticks (10 oz.) butter, softened',
			1 / 2,
			{ amount: { min: 1.25 }, unit: 'sticks (5 oz.)', item: 'butter', preparation: 'softened' },
		],
	])('measures "%s" in sticks, whose weight scales with them, by %s', (text, factor, parts) => {
		expect(scaleIngredientLine(parseIngredientLine(text), factor)).toStrictEqual({
			line: { text, ...parts },
		});
	});

	it.each<[string, number, ScaledParts]>([
		[
			'4 chicken breasts (6 ounces each)',
			2,
			{ amount: { min: 8 }, item: 'chicken breasts (6 ounces each)' },
		],
		[
			'4 chicken breasts (6 ounces each)',
			1 / 2,
			{ amount: { min: 2 }, item: 'chicken breasts (6 ounces each)' },
		],
		[
			'2 whole chickens, about 4 pounds each',
			1 / 2,
			{ amount: { min: 1 }, item: 'whole chicken', preparation: 'about 4 pounds each' },
		],
		[
			'1 (8 ounce) package cream cheese',
			2,
			{ amount: { min: 2 }, item: '(8 ounce) packages cream cheese' },
		],
		[
			'1 (8 ounce) package cream cheese',
			1 / 2,
			{ amount: { min: 0.5 }, item: '(8 ounce) package cream cheese' },
		],
		[
			'2 (8 ounce) packages cream cheese',
			1 / 2,
			{ amount: { min: 1 }, item: '(8 ounce) package cream cheese' },
		],
		[
			'1 (8-ounce) package cream cheese, softened',
			2,
			{ amount: { min: 2 }, item: '(8-ounce) packages cream cheese', preparation: 'softened' },
		],
		[
			'1 can Eagle Brand (15-oz)',
			2,
			{ amount: { min: 2 }, unit: 'cans', item: 'Eagle Brand (15-oz)' },
		],
		[
			'1 can Eagle Brand (15-oz)',
			1 / 2,
			{ amount: { min: 0.5 }, unit: 'can', item: 'Eagle Brand (15-oz)' },
		],
		[
			'1 whole chicken, about 4 pounds',
			2,
			{ amount: { min: 2 }, item: 'whole chickens', preparation: 'about 4 pounds' },
		],
		[
			'1 whole chicken, about 4 pounds',
			1 / 2,
			{ amount: { min: 0.5 }, item: 'whole chicken', preparation: 'about 4 pounds' },
		],
		[
			'1 lemon, juiced (about 3 tablespoons)',
			2,
			{ amount: { min: 2 }, item: 'lemons', preparation: 'juiced (about 3 tablespoons)' },
		],
		[
			'1 envelope (2¼ teaspoons) active dry yeast',
			2,
			{ amount: { min: 2 }, unit: 'envelopes (2¼ teaspoons)', item: 'active dry yeast' },
		],
		[
			'2 tomatoes or 1 can (14 ounces)',
			2,
			{ amount: { min: 4 }, item: 'tomatoes or 2 cans (14 ounces)' },
		],
		[
			'1 pound sausage (4 8-ounce links)',
			1 / 2,
			{ amount: { min: 0.5 }, unit: 'pound', item: 'sausage (2 8-ounce links)' },
		],
	])(
		'keeps the size of each item in "%s", right at any scale, by %s without a mark',
		(text, factor, parts) => {
			expect(scaleIngredientLine(parseIngredientLine(text), factor)).toStrictEqual({
				line: { text, ...parts },
			});
		}
	);

	it.each<[string, number, ScaledParts]>([
		[
			'2 cups water, heated to 110°F',
			2,
			{ amount: { min: 4 }, unit: 'cups', item: 'water', preparation: 'heated to 110°F' },
		],
		[
			'1 cup pecans, toasted for 5 minutes',
			1 / 2,
			{ amount: { min: 0.5 }, unit: 'cup', item: 'pecans', preparation: 'toasted for 5 minutes' },
		],
		['1 #10 can tomatoes', 2, { amount: { min: 2 }, item: '#10 can tomatoes' }],
		[
			'1 cup butter, melted, in a 9x13 pan',
			2,
			{ amount: { min: 2 }, unit: 'cups', item: 'butter', preparation: 'melted, in a 9x13 pan' },
		],
		[
			'1/2 tsp smoked paprika (optional, Note 2)',
			2,
			{ amount: { min: 1 }, unit: 'tsp', item: 'smoked paprika (optional, Note 2)' },
		],
		[
			'2 cups flour, divided into 3 portions',
			1 / 2,
			{ amount: { min: 1 }, unit: 'cup', item: 'flour', preparation: 'divided into 3 portions' },
		],
		[
			'1 lemon, cut into 8 wedges',
			1 / 2,
			{ amount: { min: 0.5 }, item: 'lemon', preparation: 'cut into 8 wedges' },
		],
		['1 cup milk (2% fat)', 2, { amount: { min: 2 }, unit: 'cups', item: 'milk (2% fat)' }],
		['1 cup milk (2% fat)', 1 / 2, { amount: { min: 0.5 }, unit: 'cup', item: 'milk (2% fat)' }],
		['1 cup milk (2 percent)', 2, { amount: { min: 2 }, unit: 'cups', item: 'milk (2 percent)' }],
		[
			'1 cup milk (2 percent)',
			1 / 2,
			{ amount: { min: 0.5 }, unit: 'cup', item: 'milk (2 percent)' },
		],
		['1 cup milk (1% or 2%)', 2, { amount: { min: 2 }, unit: 'cups', item: 'milk (1% or 2%)' }],
		[
			'1 cup milk (1% or 2%)',
			1 / 2,
			{ amount: { min: 0.5 }, unit: 'cup', item: 'milk (1% or 2%)' },
		],
		[
			'4 ounces chocolate (85% cacao)',
			2,
			{ amount: { min: 8 }, unit: 'ounces', item: 'chocolate (85% cacao)' },
		],
		[
			'4 ounces chocolate (85% cacao)',
			1 / 2,
			{ amount: { min: 2 }, unit: 'ounces', item: 'chocolate (85% cacao)' },
		],
		[
			'4 ounces chocolate, 70% dark',
			2,
			{ amount: { min: 8 }, unit: 'ounces', item: 'chocolate', preparation: '70% dark' },
		],
		[
			'4 ounces chocolate, 70% dark',
			1 / 2,
			{ amount: { min: 2 }, unit: 'ounces', item: 'chocolate', preparation: '70% dark' },
		],
		['1 cup water (110 F)', 2, { amount: { min: 2 }, unit: 'cups', item: 'water (110 F)' }],
		['1 cup water (110 F)', 1 / 2, { amount: { min: 0.5 }, unit: 'cup', item: 'water (110 F)' }],
		['1 cup water (110F)', 2, { amount: { min: 2 }, unit: 'cups', item: 'water (110F)' }],
		['1 cup water (110F)', 1 / 2, { amount: { min: 0.5 }, unit: 'cup', item: 'water (110F)' }],
		['1 cup water (45 C)', 2, { amount: { min: 2 }, unit: 'cups', item: 'water (45 C)' }],
		['1 cup water (45 C)', 1 / 2, { amount: { min: 0.5 }, unit: 'cup', item: 'water (45 C)' }],
		['1 cup water (110F/45C)', 2, { amount: { min: 2 }, unit: 'cups', item: 'water (110F/45C)' }],
		[
			'1 cup water (110F/45C)',
			1 / 2,
			{ amount: { min: 0.5 }, unit: 'cup', item: 'water (110F/45C)' },
		],
		[
			'1 cup water (40 to 45 C)',
			2,
			{ amount: { min: 2 }, unit: 'cups', item: 'water (40 to 45 C)' },
		],
		[
			'1 cup water (40 to 45 C)',
			1 / 2,
			{ amount: { min: 0.5 }, unit: 'cup', item: 'water (40 to 45 C)' },
		],
		['1 cup water (105-115 F)', 2, { amount: { min: 2 }, unit: 'cups', item: 'water (105-115 F)' }],
		[
			'1 cup water (105-115 F)',
			1 / 2,
			{ amount: { min: 0.5 }, unit: 'cup', item: 'water (105-115 F)' },
		],
		[
			'1 cup water (350 degrees)',
			2,
			{ amount: { min: 2 }, unit: 'cups', item: 'water (350 degrees)' },
		],
		[
			'1 cup water (350 degrees)',
			1 / 2,
			{ amount: { min: 0.5 }, unit: 'cup', item: 'water (350 degrees)' },
		],
		['1 cup water (110 deg F)', 2, { amount: { min: 2 }, unit: 'cups', item: 'water (110 deg F)' }],
		[
			'1 cup water (110 deg F)',
			1 / 2,
			{ amount: { min: 0.5 }, unit: 'cup', item: 'water (110 deg F)' },
		],
		[
			'1 cup water, heated to 110 F',
			2,
			{ amount: { min: 2 }, unit: 'cups', item: 'water', preparation: 'heated to 110 F' },
		],
		[
			'1 cup water, heated to 110 F',
			1 / 2,
			{ amount: { min: 0.5 }, unit: 'cup', item: 'water', preparation: 'heated to 110 F' },
		],
		[
			'2 eggs, at room temperature (70 F)',
			2,
			{ amount: { min: 4 }, item: 'eggs', preparation: 'at room temperature (70 F)' },
		],
		[
			'2 eggs, at room temperature (70 F)',
			1 / 2,
			{ amount: { min: 1 }, item: 'egg', preparation: 'at room temperature (70 F)' },
		],
		[
			'1 cup simple syrup (1:1)',
			2,
			{ amount: { min: 2 }, unit: 'cups', item: 'simple syrup (1:1)' },
		],
		[
			'1 cup simple syrup (1:1)',
			1 / 2,
			{ amount: { min: 0.5 }, unit: 'cup', item: 'simple syrup (1:1)' },
		],
		[
			'1 cup brine (1:16 salt to water)',
			2,
			{ amount: { min: 2 }, unit: 'cups', item: 'brine (1:16 salt to water)' },
		],
		[
			'1 cup brine (1:16 salt to water)',
			1 / 2,
			{ amount: { min: 0.5 }, unit: 'cup', item: 'brine (1:16 salt to water)' },
		],
		[
			'1 cup simple syrup (1 part sugar to 1 part water)',
			2,
			{ amount: { min: 2 }, unit: 'cups', item: 'simple syrup (1 part sugar to 1 part water)' },
		],
		[
			'1 cup simple syrup (1 part sugar to 1 part water)',
			1 / 2,
			{ amount: { min: 0.5 }, unit: 'cup', item: 'simple syrup (1 part sugar to 1 part water)' },
		],
		['2 eggs (size 2)', 2, { amount: { min: 4 }, item: 'eggs (size 2)' }],
		['2 eggs (size 2)', 1 / 2, { amount: { min: 1 }, item: 'egg (size 2)' }],
		['1 kg flour (tipo 00)', 2, { amount: { min: 2 }, unit: 'kg', item: 'flour (tipo 00)' }],
		['1 kg flour (tipo 00)', 1 / 2, { amount: { min: 0.5 }, unit: 'kg', item: 'flour (tipo 00)' }],
		['1 (No. 10) can tomatoes', 2, { amount: { min: 2 }, item: '(No. 10) cans tomatoes' }],
		['1 (No. 10) can tomatoes', 1 / 2, { amount: { min: 0.5 }, item: '(No. 10) can tomatoes' }],
		[
			'1 cup cheddar (aged 18 months)',
			2,
			{ amount: { min: 2 }, unit: 'cups', item: 'cheddar (aged 18 months)' },
		],
		[
			'1 cup cheddar (aged 18 months)',
			1 / 2,
			{ amount: { min: 0.5 }, unit: 'cup', item: 'cheddar (aged 18 months)' },
		],
		[
			'1 cup flour, sifted 2 times',
			2,
			{ amount: { min: 2 }, unit: 'cups', item: 'flour', preparation: 'sifted 2 times' },
		],
		[
			'1 cup flour, sifted 2 times',
			1 / 2,
			{ amount: { min: 0.5 }, unit: 'cup', item: 'flour', preparation: 'sifted 2 times' },
		],
		['1 cup water (2)', 2, { amount: { min: 2 }, unit: 'cups', item: 'water (2)' }],
		['1 cup water (2)', 1 / 2, { amount: { min: 0.5 }, unit: 'cup', item: 'water (2)' }],
		['1 cup water (one to 2)', 2, { amount: { min: 2 }, unit: 'cups', item: 'water (one to 2)' }],
		[
			'1 cup water (one to 2)',
			1 / 2,
			{ amount: { min: 0.5 }, unit: 'cup', item: 'water (one to 2)' },
		],
		[
			'1 cup chopped onion (about 2)',
			2,
			{ amount: { min: 2 }, unit: 'cups', item: 'chopped onion (about 2)' },
		],
		[
			'1 cup chopped onion (about 2)',
			1 / 2,
			{ amount: { min: 0.5 }, unit: 'cup', item: 'chopped onion (about 2)' },
		],
		[
			'1 pound ground beef (80/20)',
			2,
			{ amount: { min: 2 }, unit: 'pounds', item: 'ground beef (80/20)' },
		],
		[
			'1 pound ground beef (80/20)',
			1 / 2,
			{ amount: { min: 0.5 }, unit: 'pound', item: 'ground beef (80/20)' },
		],
		['1 lb 80/20 ground beef', 2, { amount: { min: 2 }, unit: 'lb', item: '80/20 ground beef' }],
		[
			'1 lb 80/20 ground beef',
			1 / 2,
			{ amount: { min: 0.5 }, unit: 'lb', item: '80/20 ground beef' },
		],
		['1 cup vodka (80 proof)', 2, { amount: { min: 2 }, unit: 'cups', item: 'vodka (80 proof)' }],
		[
			'1 cup vodka (80 proof)',
			1 / 2,
			{ amount: { min: 0.5 }, unit: 'cup', item: 'vodka (80 proof)' },
		],
		['1 cup flour (T55)', 2, { amount: { min: 2 }, unit: 'cups', item: 'flour (T55)' }],
		['1 cup flour (T55)', 1 / 2, { amount: { min: 0.5 }, unit: 'cup', item: 'flour (T55)' }],
		['1 kg 00 flour', 2, { amount: { min: 2 }, unit: 'kg', item: '00 flour' }],
		['1 kg 00 flour', 1 / 2, { amount: { min: 0.5 }, unit: 'kg', item: '00 flour' }],
		['1 cup 5-minute rice', 2, { amount: { min: 2 }, unit: 'cups', item: '5-minute rice' }],
		['1 cup 5-minute rice', 1 / 2, { amount: { min: 0.5 }, unit: 'cup', item: '5-minute rice' }],
		[
			'1 cup water (between 105 and 115 F)',
			2,
			{ amount: { min: 2 }, unit: 'cups', item: 'water (between 105 and 115 F)' },
		],
		[
			'1 cup water (between 105 and 115 F)',
			1 / 2,
			{ amount: { min: 0.5 }, unit: 'cup', item: 'water (between 105 and 115 F)' },
		],
		[
			'1 cup water (between 40 and 45 C)',
			2,
			{ amount: { min: 2 }, unit: 'cups', item: 'water (between 40 and 45 C)' },
		],
		[
			'1 cup water (between 40 and 45 C)',
			1 / 2,
			{ amount: { min: 0.5 }, unit: 'cup', item: 'water (between 40 and 45 C)' },
		],
		['1 cup water (40.5 C)', 2, { amount: { min: 2 }, unit: 'cups', item: 'water (40.5 C)' }],
		['1 cup water (40.5 C)', 1 / 2, { amount: { min: 0.5 }, unit: 'cup', item: 'water (40.5 C)' }],
		['1 cup water (40,5 C)', 2, { amount: { min: 2 }, unit: 'cups', item: 'water (40,5 C)' }],
		['1 cup water (40,5 C)', 1 / 2, { amount: { min: 0.5 }, unit: 'cup', item: 'water (40,5 C)' }],
		[
			'1 cup water (40 to 45.5 C)',
			2,
			{ amount: { min: 2 }, unit: 'cups', item: 'water (40 to 45.5 C)' },
		],
		[
			'1 cup water (40 to 45.5 C)',
			1 / 2,
			{ amount: { min: 0.5 }, unit: 'cup', item: 'water (40 to 45.5 C)' },
		],
		[
			'1 cup water (between 40.5 and 45.5 C)',
			2,
			{ amount: { min: 2 }, unit: 'cups', item: 'water (between 40.5 and 45.5 C)' },
		],
		[
			'1 cup water (between 40.5 and 45.5 C)',
			1 / 2,
			{ amount: { min: 0.5 }, unit: 'cup', item: 'water (between 40.5 and 45.5 C)' },
		],
		[
			'1 cup water, heated to 45 C.',
			2,
			{ amount: { min: 2 }, unit: 'cups', item: 'water', preparation: 'heated to 45 C.' },
		],
		[
			'1 cup water, heated to 45 C.',
			1 / 2,
			{ amount: { min: 0.5 }, unit: 'cup', item: 'water', preparation: 'heated to 45 C.' },
		],
		['1 cup water (40.5°C)', 2, { amount: { min: 2 }, unit: 'cups', item: 'water (40.5°C)' }],
		['1 cup water (40.5°C)', 1 / 2, { amount: { min: 0.5 }, unit: 'cup', item: 'water (40.5°C)' }],
		['1 cup water (105.5 F)', 2, { amount: { min: 2 }, unit: 'cups', item: 'water (105.5 F)' }],
		[
			'1 cup water (105.5 F)',
			1 / 2,
			{ amount: { min: 0.5 }, unit: 'cup', item: 'water (105.5 F)' },
		],
		[
			'1 cup water (105.5 degrees)',
			2,
			{ amount: { min: 2 }, unit: 'cups', item: 'water (105.5 degrees)' },
		],
		[
			'1 cup water (105.5 degrees)',
			1 / 2,
			{ amount: { min: 0.5 }, unit: 'cup', item: 'water (105.5 degrees)' },
		],
		[
			'1 package yeast, dissolved in warm water (between 105 and 115 F)',
			2,
			{
				amount: { min: 2 },
				unit: 'packages',
				item: 'yeast',
				preparation: 'dissolved in warm water (between 105 and 115 F)',
			},
		],
		[
			'1 package yeast, dissolved in warm water (between 105 and 115 F)',
			1 / 2,
			{
				amount: { min: 0.5 },
				unit: 'package',
				item: 'yeast',
				preparation: 'dissolved in warm water (between 105 and 115 F)',
			},
		],
		[
			'2 cups milk, heated to between 105 and 115 degrees',
			2,
			{
				amount: { min: 4 },
				unit: 'cups',
				item: 'milk',
				preparation: 'heated to between 105 and 115 degrees',
			},
		],
		[
			'2 cups milk, heated to between 105 and 115 degrees',
			1 / 2,
			{
				amount: { min: 1 },
				unit: 'cup',
				item: 'milk',
				preparation: 'heated to between 105 and 115 degrees',
			},
		],
	])(
		'keeps the number in "%s", which is no amount, by %s without a mark',
		(text, factor, parts) => {
			expect(scaleIngredientLine(parseIngredientLine(text), factor)).toStrictEqual({
				line: { text, ...parts },
			});
		}
	);

	it.each<[string, number, ScaledParts, IngredientLineSpan[]]>([
		[
			'2 sweet potatoes (about 1 pound)',
			2,
			{ amount: { min: 4 }, item: 'sweet potatoes (about 1 pound)' },
			[{ field: 'item', start: 22, end: 29 }],
		],
		[
			'2 sweet potatoes (about 1 pound)',
			1 / 2,
			{ amount: { min: 1 }, item: 'sweet potato (about 1 pound)' },
			[{ field: 'item', start: 20, end: 27 }],
		],
		[
			'2 sweet potatoes (about 1 pound)',
			1 / 4,
			{ amount: { min: 0.5 }, item: 'sweet potato (about 1 pound)' },
			[{ field: 'item', start: 20, end: 27 }],
		],
		[
			'2 whole chickens, about 4 pounds',
			2,
			{ amount: { min: 4 }, item: 'whole chickens', preparation: 'about 4 pounds' },
			[{ field: 'preparation', start: 6, end: 14 }],
		],
		[
			'2 envelopes (4½ teaspoons) active dry yeast',
			2,
			{ amount: { min: 4 }, unit: 'envelopes (4½ teaspoons)', item: 'active dry yeast' },
			[{ field: 'unit', start: 11, end: 23 }],
		],
		[
			'2 envelopes (4½ teaspoons) active dry yeast',
			1 / 2,
			{ amount: { min: 1 }, unit: 'envelope (4½ teaspoons)', item: 'active dry yeast' },
			[{ field: 'unit', start: 10, end: 22 }],
		],
		[
			'3 cloves garlic (about 1 tablespoon minced)',
			2,
			{ amount: { min: 6 }, unit: 'cloves', item: 'garlic (about 1 tablespoon minced)' },
			[{ field: 'item', start: 14, end: 26 }],
		],
		[
			'2 tomatoes or 2 cans (14 ounces)',
			1 / 2,
			{ amount: { min: 1 }, item: 'tomato or 1 can (14 ounces)' },
			[{ field: 'item', start: 17, end: 26 }],
		],
		[
			'2 sweet potatoes (between 1 and 2 pounds)',
			2,
			{ amount: { min: 4 }, item: 'sweet potatoes (between 1 and 2 pounds)' },
			[{ field: 'item', start: 16, end: 38 }],
		],
		[
			'2 sweet potatoes (between 1 and 2 pounds)',
			1 / 2,
			{ amount: { min: 1 }, item: 'sweet potato (between 1 and 2 pounds)' },
			[{ field: 'item', start: 14, end: 36 }],
		],
	])(
		'marks the amount in "%s" it cannot vouch for, after a count above one, unscaled by %s',
		(text, factor, parts, amounts) => {
			expect(scaleIngredientLine(parseIngredientLine(text), factor)).toStrictEqual({
				line: { text, ...parts },
				unscaled: { amounts },
			});
		}
	);

	it.each<[string, number, ScaledParts]>([
		['one half-pint jar cream', 2, { amount: { min: 2 }, item: 'half-pint jars cream' }],
		['one half-pint jar cream', 1 / 2, { amount: { min: 0.5 }, item: 'half-pint jar cream' }],
		[
			'2 (8 ounce) packages cream cheese',
			2,
			{ amount: { min: 4 }, item: '(8 ounce) packages cream cheese' },
		],
	])(
		'makes the container after its size in "%s" agree with the count by %s',
		(text, factor, parts) => {
			expect(scaleIngredientLine(parseIngredientLine(text), factor)).toStrictEqual({
				line: { text, ...parts },
			});
		}
	);

	it.each<[string, number, ScaledParts]>([
		['2 fillets salmon (skin on)', 2, { amount: { min: 4 }, item: 'fillets salmon (skin on)' }],
		['2 fillets salmon (skin on)', 1 / 2, { amount: { min: 1 }, item: 'fillet salmon (skin on)' }],
		['2 fillets of salmon', 1 / 2, { amount: { min: 1 }, item: 'fillet of salmon' }],
		['1 fillet of salmon', 2, { amount: { min: 2 }, item: 'fillets of salmon' }],
		['1 fillet of salmon', 1 / 2, { amount: { min: 0.5 }, item: 'fillet of salmon' }],
		['2 chipotles in adobo', 2, { amount: { min: 4 }, item: 'chipotles in adobo' }],
		['2 chipotles in adobo', 1 / 2, { amount: { min: 1 }, item: 'chipotle in adobo' }],
		['2 of the eggs', 2, { amount: { min: 4 }, item: 'of the eggs' }],
		['2 of the eggs', 1 / 2, { amount: { min: 1 }, item: 'of the eggs' }],
		['2 Eggs well beaten', 1 / 2, { amount: { min: 1 }, item: 'Egg well beaten' }],
		[
			'2 sweet potatoes, peeled',
			1 / 2,
			{ amount: { min: 1 }, item: 'sweet potato', preparation: 'peeled' },
		],
		[
			'1 sweet potato, peeled',
			2,
			{ amount: { min: 2 }, item: 'sweet potatoes', preparation: 'peeled' },
		],
		[
			'2 cloves garlic (minced)',
			1 / 2,
			{ amount: { min: 1 }, unit: 'clove', item: 'garlic (minced)' },
		],
		['2 garlic cloves (minced)', 1 / 2, { amount: { min: 1 }, item: 'garlic clove (minced)' }],
		['2 Brussels sprouts', 1 / 2, { amount: { min: 1 }, item: 'Brussels sprout' }],
		['2 star anise', 1 / 2, { amount: { min: 1 }, item: 'star anise' }],
	])(
		'makes the noun the count in "%s" counts agree with it by %s, though other words follow it',
		(text, factor, parts) => {
			expect(scaleIngredientLine(parseIngredientLine(text), factor)).toStrictEqual({
				line: { text, ...parts },
			});
		}
	);

	it.each<[string, number, ScaledParts]>([
		['1 bar chocolate', 2, { amount: { min: 2 }, unit: 'bars', item: 'chocolate' }],
		['1 bar chocolate', 1 / 2, { amount: { min: 0.5 }, unit: 'bar', item: 'chocolate' }],
		[
			'2 bars chocolate (70% dark)',
			2,
			{ amount: { min: 4 }, unit: 'bars', item: 'chocolate (70% dark)' },
		],
		[
			'2 bars chocolate (70% dark)',
			1 / 2,
			{ amount: { min: 1 }, unit: 'bar', item: 'chocolate (70% dark)' },
		],
		['1 bar of chocolate', 2, { amount: { min: 2 }, unit: 'bars', item: 'chocolate' }],
		['1 tube tomato paste', 2, { amount: { min: 2 }, unit: 'tubes', item: 'tomato paste' }],
		['1 tube tomato paste', 1 / 2, { amount: { min: 0.5 }, unit: 'tube', item: 'tomato paste' }],
		['2 tubes biscuits', 2, { amount: { min: 4 }, unit: 'tubes', item: 'biscuits' }],
		['2 tubes biscuits', 1 / 2, { amount: { min: 1 }, unit: 'tube', item: 'biscuits' }],
		['1 bottle wine', 2, { amount: { min: 2 }, unit: 'bottles', item: 'wine' }],
		['1 bottle wine', 1 / 2, { amount: { min: 0.5 }, unit: 'bottle', item: 'wine' }],
		[
			'1 bottle (750 ml) red wine',
			2,
			{ amount: { min: 2 }, unit: 'bottles (750 ml)', item: 'red wine' },
		],
		['1 tub ricotta', 2, { amount: { min: 2 }, unit: 'tubs', item: 'ricotta' }],
		['1 tub ricotta', 1 / 2, { amount: { min: 0.5 }, unit: 'tub', item: 'ricotta' }],
	])(
		'counts "%s" in its unit, which takes the number in place of the item, by %s',
		(text, factor, parts) => {
			expect(scaleIngredientLine(parseIngredientLine(text), factor)).toStrictEqual({
				line: { text, ...parts },
			});
		}
	);

	it.each<[string, number, ScaledParts]>([
		[
			'2 eggs (1 for the dough and 1 for the wash)',
			2,
			{ amount: { min: 4 }, item: 'eggs (2 for the dough and 2 for the wash)' },
		],
		[
			'2 eggs (1 for the dough and 1 for the wash)',
			1 / 2,
			{ amount: { min: 1 }, item: 'egg (½ for the dough and ½ for the wash)' },
		],
		[
			'4 lemons (2 for zest, 2 for juice)',
			2,
			{ amount: { min: 8 }, item: 'lemons (4 for zest, 4 for juice)' },
		],
		[
			'4 lemons (2 for zest, 2 for juice)',
			1 / 2,
			{ amount: { min: 2 }, item: 'lemons (1 for zest, 1 for juice)' },
		],
		['4 eggs (2 of them separated)', 2, { amount: { min: 8 }, item: 'eggs (4 of them separated)' }],
		[
			'4 eggs (2 of them separated)',
			1 / 2,
			{ amount: { min: 2 }, item: 'eggs (1 of them separated)' },
		],
		[
			'1 cup sugar, divided: ½ for the dough and ½ for the topping',
			2,
			{
				amount: { min: 2 },
				unit: 'cups',
				item: 'sugar',
				preparation: 'divided: 1 for the dough and 1 for the topping',
			},
		],
		[
			'1 cup sugar, divided: ½ for the dough and ½ for the topping',
			1 / 2,
			{
				amount: { min: 0.5 },
				unit: 'cup',
				item: 'sugar',
				preparation: 'divided: ¼ for the dough and ¼ for the topping',
			},
		],
	])(
		'scales the shares of the line’s count in "%s" with it by %s, leaving the words after them as written',
		(text, factor, parts) => {
			expect(scaleIngredientLine(parseIngredientLine(text), factor)).toStrictEqual({
				line: { text, ...parts },
			});
		}
	);

	it.each<[string, number, ScaledParts]>([
		['4 eggs (½ of them separated)', 2, { amount: { min: 8 }, item: 'eggs (½ of them separated)' }],
		[
			'4 eggs (½ of them separated)',
			1 / 2,
			{ amount: { min: 2 }, item: 'eggs (½ of them separated)' },
		],
		[
			'4 eggs (half of them separated)',
			2,
			{ amount: { min: 8 }, item: 'eggs (half of them separated)' },
		],
		[
			'4 eggs (half of them separated)',
			1 / 2,
			{ amount: { min: 2 }, item: 'eggs (half of them separated)' },
		],
		[
			'6 eggs (a third of the eggs separated)',
			2,
			{ amount: { min: 12 }, item: 'eggs (a third of the eggs separated)' },
		],
		[
			'6 eggs (a third of the eggs separated)',
			1 / 2,
			{ amount: { min: 3 }, item: 'eggs (a third of the eggs separated)' },
		],
		[
			'6 eggs (two-thirds of them beaten)',
			2,
			{ amount: { min: 12 }, item: 'eggs (two-thirds of them beaten)' },
		],
		[
			'6 eggs (two-thirds of them beaten)',
			1 / 2,
			{ amount: { min: 3 }, item: 'eggs (two-thirds of them beaten)' },
		],
		[
			'4 eggs (one of every two separated)',
			2,
			{ amount: { min: 8 }, item: 'eggs (one of every two separated)' },
		],
		[
			'4 eggs (one of every two separated)',
			1 / 2,
			{ amount: { min: 2 }, item: 'eggs (one of every two separated)' },
		],
		[
			'1 cup sugar (½ of it for the topping)',
			2,
			{ amount: { min: 2 }, unit: 'cups', item: 'sugar (½ of it for the topping)' },
		],
		[
			'1 cup sugar (½ of it for the topping)',
			1 / 2,
			{ amount: { min: 0.5 }, unit: 'cup', item: 'sugar (½ of it for the topping)' },
		],
	])(
		'keeps the share of the whole in "%s", right at any scale, by %s without a mark',
		(text, factor, parts) => {
			expect(scaleIngredientLine(parseIngredientLine(text), factor)).toStrictEqual({
				line: { text, ...parts },
			});
		}
	);

	it.each<[string, number, ScaledParts]>([
		[
			'1 can artichoke quarters',
			2,
			{ amount: { min: 2 }, unit: 'cans', item: 'artichoke quarters' },
		],
		['1 cup half and half', 2, { amount: { min: 2 }, unit: 'cups', item: 'half and half' }],
		['1 lemon, cut in half', 2, { amount: { min: 2 }, item: 'lemons', preparation: 'cut in half' }],
		[
			'2 tablespoons five-spice powder',
			2,
			{ amount: { min: 0.25 }, unit: 'cup', item: 'five-spice powder' },
		],
		[
			'1 cup flour, divided into thirds',
			2,
			{ amount: { min: 2 }, unit: 'cups', item: 'flour', preparation: 'divided into thirds' },
		],
	])(
		'scales "%s", whose number words name rather than count, by %s without a mark',
		(text, factor, parts) => {
			expect(scaleIngredientLine(parseIngredientLine(text), factor)).toStrictEqual({
				line: { text, ...parts },
			});
		}
	);
});
