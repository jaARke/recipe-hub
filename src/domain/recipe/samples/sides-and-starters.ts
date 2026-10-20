import type { RecipeContentInput } from '@/domain/recipe/recipe';

// Synthetic recipes for tests, the seed script, and the design reference. Never real family data.

export const sampleTomatoBasilBruschetta: RecipeContentInput = {
	title: 'Tomato basil bruschetta',
	description:
		'Toasted bread rubbed with garlic and piled with chopped tomatoes, basil, and olive oil.',
	yield: { kind: 'servings', amount: { min: 6 } },
	times: { prepMinutes: 15 },
	ingredientSections: [
		{
			lines: [
				{ text: '1 baguette, sliced', amount: { min: 1 }, item: 'baguette', preparation: 'sliced' },
				{
					text: '1 garlic clove, halved',
					amount: { min: 1 },
					item: 'garlic clove',
					preparation: 'halved',
				},
				{
					text: '4 ripe tomatoes, chopped',
					amount: { min: 4 },
					item: 'ripe tomatoes',
					preparation: 'chopped',
				},
				{
					text: '¼ cup basil, torn',
					amount: { min: 0.25 },
					unit: 'cup',
					item: 'basil',
					preparation: 'torn',
				},
				{
					text: '3 tablespoons olive oil',
					amount: { min: 3 },
					unit: 'tablespoons',
					item: 'olive oil',
				},
			],
		},
	],
	instructionSections: [
		{
			steps: [
				{ text: 'Toast the bread slices until crisp, then rub each with the cut garlic.' },
				{ text: 'Toss the tomatoes, basil, oil, and a pinch of salt.' },
				{ text: 'Spoon over the toast just before serving.' },
			],
		},
	],
	chapter: 'appetizers-beverages',
	holidays: [],
	diets: ['vegetarian'],
	tags: ['Appetizer', 'Vegetarian', 'Summer'],
	images: [],
};

export const sampleAppleCabbageSlaw: RecipeContentInput = {
	title: 'Apple cabbage slaw',
	description: 'Crunchy shredded cabbage and green apple in a tangy cider vinegar dressing.',
	times: {},
	ingredientSections: [
		{
			lines: [
				{
					text: '½ head green cabbage, shredded',
					amount: { min: 0.5 },
					unit: 'head',
					item: 'green cabbage',
					preparation: 'shredded',
				},
				{
					text: '2 green apples, julienned',
					amount: { min: 2 },
					item: 'green apples',
					preparation: 'julienned',
				},
				{
					text: '3 tablespoons cider vinegar',
					amount: { min: 3 },
					unit: 'tablespoons',
					item: 'cider vinegar',
				},
				{ text: '2 tablespoons honey', amount: { min: 2 }, unit: 'tablespoons', item: 'honey' },
			],
		},
	],
	instructionSections: [
		{
			steps: [
				{ text: 'Whisk the vinegar, honey, and a pinch of salt.' },
				{ text: 'Toss with the cabbage and apples and let stand a few minutes before serving.' },
				{ text: 'Taste and adjust the salt.' },
			],
		},
	],
	chapter: 'vegetables-sides',
	holidays: [],
	diets: ['vegetarian', 'gluten-free', 'dairy-free'],
	tags: ['Salad', 'Vegetarian'],
	images: [],
};

export const sampleQuickPickledOnions: RecipeContentInput = {
	title: 'Quick pickled red onions',
	description: 'Thin red onion rings in a sweet vinegar brine, good on tacos and sandwiches.',
	times: {},
	ingredientSections: [
		{
			lines: [
				{
					text: '1 red onion, thinly sliced',
					amount: { min: 1 },
					item: 'red onion',
					preparation: 'thinly sliced',
				},
				{ text: '1 cup white vinegar', amount: { min: 1 }, unit: 'cup', item: 'white vinegar' },
				{ text: '1 tablespoon sugar', amount: { min: 1 }, unit: 'tablespoon', item: 'sugar' },
				{ text: '1 teaspoon salt', amount: { min: 1 }, unit: 'teaspoon', item: 'salt' },
			],
		},
	],
	instructionSections: [
		{
			steps: [
				{ text: 'Warm the vinegar, sugar, and salt until dissolved.' },
				{ text: 'Pour the brine over the onions in a jar and let cool.' },
				{ text: 'Refrigerate until the onions turn bright pink.' },
			],
		},
	],
	chapter: 'this-and-that',
	holidays: [],
	diets: ['vegetarian', 'vegan', 'dairy-free'],
	tags: [],
	images: [],
};
