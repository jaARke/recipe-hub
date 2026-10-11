import type { RecipeContentInput } from '@/domain/recipe/recipe';

// Synthetic recipes matching the design reference's cards. Never real family data.

export const sampleButtermilkBiscuits: RecipeContentInput = {
	title: 'Buttermilk biscuits',
	description:
		'Tall, flaky biscuits that June baked every Sunday morning. Cold butter and a gentle hand do most of the work.',
	notes:
		'June cut her biscuits with a juice glass and never twisted it, because twisting seals the edges and keeps them from rising. She said cold hands make the best biscuits.',
	source: 'Aunt June',
	yield: { kind: 'makes', amount: { min: 10 }, unit: 'biscuits' },
	times: { prepMinutes: 15, cookMinutes: 18, totalMinutes: 35 },
	ingredientSections: [
		{
			lines: [
				{
					text: '2½ cups all-purpose flour',
					amount: { min: 2.5 },
					unit: 'cups',
					item: 'all-purpose flour',
				},
				{
					text: '1 tablespoon baking powder',
					amount: { min: 1 },
					unit: 'tablespoon',
					item: 'baking powder',
				},
				{ text: '1 teaspoon fine salt', amount: { min: 1 }, unit: 'teaspoon', item: 'fine salt' },
				{
					text: '½ teaspoon baking soda',
					amount: { min: 0.5 },
					unit: 'teaspoon',
					item: 'baking soda',
				},
				{
					text: '10 tablespoons cold unsalted butter, cubed',
					amount: { min: 10 },
					unit: 'tablespoons',
					item: 'cold unsalted butter',
					preparation: 'cubed',
				},
				{ text: '1 cup cold buttermilk', amount: { min: 1 }, unit: 'cup', item: 'cold buttermilk' },
			],
		},
		{
			heading: 'For the honey butter',
			lines: [
				{
					text: '4 tablespoons salted butter, softened',
					amount: { min: 4 },
					unit: 'tablespoons',
					item: 'salted butter',
					preparation: 'softened',
				},
				{ text: '2 tablespoons honey', amount: { min: 2 }, unit: 'tablespoons', item: 'honey' },
			],
		},
	],
	instructionSections: [
		{
			steps: [
				{ text: 'Heat the oven to 450°F and line a baking sheet with parchment.' },
				{ text: 'Whisk the flour, baking powder, salt, and baking soda in a large bowl.' },
				{
					text: 'Rub the butter into the flour with your fingertips until the pieces are the size of peas.',
				},
				{
					text: 'Stir in the buttermilk with a fork until a shaggy dough forms. Stop as soon as it holds together.',
				},
				{
					text: 'Pat the dough 1 inch thick, fold it in thirds, and pat it out again. Repeat the fold twice.',
				},
				{
					text: 'Cut 2½-inch rounds, set them touching on the sheet, and bake 15 to 18 minutes until golden.',
				},
				{
					text: 'Beat the butter and honey together and serve with the biscuits while they are warm.',
				},
			],
		},
	],
	tags: ['Breakfast', 'Baking'],
	images: [],
};

export const sampleChickenSoup: RecipeContentInput = {
	title: 'Weeknight chicken soup',
	source: 'Grandpa Lou',
	yield: { kind: 'servings', amount: { min: 6 } },
	times: { prepMinutes: 15, cookMinutes: 35 },
	ingredientSections: [
		{
			lines: [
				{
					text: '1 tablespoon olive oil',
					amount: { min: 1 },
					unit: 'tablespoon',
					item: 'olive oil',
				},
				{
					text: '1 yellow onion, diced',
					amount: { min: 1 },
					item: 'yellow onion',
					preparation: 'diced',
				},
				{
					text: '2 to 3 carrots, sliced',
					amount: { min: 2, max: 3 },
					item: 'carrots',
					preparation: 'sliced',
				},
				{
					text: '2 celery stalks, sliced',
					amount: { min: 2 },
					unit: 'stalks',
					item: 'celery',
					preparation: 'sliced',
				},
				{
					text: '1½ pounds boneless chicken thighs',
					amount: { min: 1.5 },
					unit: 'pounds',
					item: 'boneless chicken thighs',
				},
				{ text: '8 cups chicken broth', amount: { min: 8 }, unit: 'cups', item: 'chicken broth' },
				{ text: '6 ounces egg noodles', amount: { min: 6 }, unit: 'ounces', item: 'egg noodles' },
				{ text: 'Salt to taste', item: 'salt', preparation: 'to taste' },
			],
		},
	],
	instructionSections: [
		{
			steps: [
				{
					text: 'Warm the oil in a large pot over medium heat and cook the onion, carrots, and celery until soft, about 8 minutes.',
				},
				{
					text: 'Add the chicken and broth, bring to a simmer, and cook until the chicken is tender, about 20 minutes.',
				},
				{ text: 'Lift out the chicken, shred it with two forks, and return it to the pot.' },
				{ text: 'Stir in the noodles and simmer until tender. Season with salt.' },
			],
		},
	],
	tags: ['Soup', 'Weeknight'],
	images: [],
};

export const sampleLemonIceboxPie: RecipeContentInput = {
	title: 'Lemon icebox pie with a graham cracker crust',
	source: 'Grandma Rose',
	yield: { kind: 'servings', amount: { min: 8 } },
	times: { prepMinutes: 15, cookMinutes: 15, totalMinutes: 270 },
	ingredientSections: [
		{
			heading: 'For the crust',
			lines: [
				{
					text: '1½ cups graham cracker crumbs',
					amount: { min: 1.5 },
					unit: 'cups',
					item: 'graham cracker crumbs',
				},
				{ text: '⅓ cup sugar', amount: { min: 1 / 3 }, unit: 'cup', item: 'sugar' },
				{
					text: '6 tablespoons butter, melted',
					amount: { min: 6 },
					unit: 'tablespoons',
					item: 'butter',
					preparation: 'melted',
				},
			],
		},
		{
			heading: 'For the filling',
			lines: [
				{
					text: '14 ounces sweetened condensed milk',
					amount: { min: 14 },
					unit: 'ounces',
					item: 'sweetened condensed milk',
				},
				{ text: '4 egg yolks', amount: { min: 4 }, item: 'egg yolks' },
				{
					text: '½ cup fresh lemon juice',
					amount: { min: 0.5 },
					unit: 'cup',
					item: 'fresh lemon juice',
				},
				{
					text: '1 tablespoon lemon zest',
					amount: { min: 1 },
					unit: 'tablespoon',
					item: 'lemon zest',
				},
			],
		},
	],
	instructionSections: [
		{
			heading: 'For the crust',
			steps: [
				{ text: 'Heat the oven to 350°F.' },
				{
					text: 'Mix the crumbs, sugar, and butter, press into a 9-inch pie plate, and bake until fragrant, about 8 minutes.',
				},
			],
		},
		{
			heading: 'For the filling',
			steps: [
				{ text: 'Whisk the condensed milk, yolks, lemon juice, and zest until smooth.' },
				{ text: 'Pour into the warm crust and bake until just set at the edges, about 7 minutes.' },
				{ text: 'Cool, then chill until firm, about 4 hours.' },
			],
		},
	],
	tags: ['Dessert', 'Make ahead'],
	images: [],
};

export const sampleTomatoSalad: RecipeContentInput = {
	title: 'Garden tomato salad',
	source: 'Cousin Maya',
	yield: { kind: 'servings', amount: { min: 4 } },
	times: { prepMinutes: 15 },
	ingredientSections: [
		{
			lines: [
				{
					text: '2 pounds ripe tomatoes, cut into wedges',
					amount: { min: 2 },
					unit: 'pounds',
					item: 'ripe tomatoes',
					preparation: 'cut into wedges',
				},
				{
					text: '½ small red onion, thinly sliced',
					amount: { min: 0.5 },
					item: 'small red onion',
					preparation: 'thinly sliced',
				},
				{
					text: '3 tablespoons olive oil',
					amount: { min: 3 },
					unit: 'tablespoons',
					item: 'olive oil',
				},
				{
					text: '1 tablespoon red wine vinegar',
					amount: { min: 1 },
					unit: 'tablespoon',
					item: 'red wine vinegar',
				},
				{
					text: '¼ cup basil leaves, torn',
					amount: { min: 0.25 },
					unit: 'cup',
					item: 'basil leaves',
					preparation: 'torn',
				},
				{
					text: 'Flaky salt and black pepper to taste',
					item: 'flaky salt and black pepper',
					preparation: 'to taste',
				},
			],
		},
	],
	instructionSections: [
		{
			steps: [
				{ text: 'Toss the tomatoes and onion with the oil and vinegar.' },
				{
					text: 'Let stand 10 minutes, then scatter the basil and season with salt and pepper.',
				},
			],
		},
	],
	tags: ['Salad', 'Vegetarian', 'Summer'],
	images: [],
};

export const sampleRecipeContents: readonly RecipeContentInput[] = [
	sampleButtermilkBiscuits,
	sampleChickenSoup,
	sampleLemonIceboxPie,
	sampleTomatoSalad,
];
