import type { ComponentProps } from 'react';
import type { RecipeCard } from '@/components/recipe/recipe-card';

// Synthetic sample content for the design reference. Never real user data.

type SampleIngredientSection = {
	heading?: string;
	ingredients: readonly { quantity: string; item: string }[];
};

type SampleMetaItem = {
	label: string;
	value: string;
};

type SampleOption = {
	value: string;
	label: string;
};

type SampleRecipe = {
	title: string;
	source: string;
	description: string;
	meta: readonly SampleMetaItem[];
	tags: readonly string[];
	ingredientSections: readonly SampleIngredientSection[];
	steps: readonly string[];
	note: string;
};

const sampleCourses: readonly SampleOption[] = [
	{ value: 'breakfast', label: 'Breakfast' },
	{ value: 'main', label: 'Main' },
	{ value: 'side', label: 'Side' },
	{ value: 'soup', label: 'Soup' },
	{ value: 'dessert', label: 'Dessert' },
	{ value: 'baking', label: 'Baking' },
];

// Every card links to the detail excerpt further down the page.
const sampleRecipeHref = '#recipe-detail';

const sampleRecipeCards: readonly ComponentProps<typeof RecipeCard>[] = [
	{
		title: 'Buttermilk biscuits',
		source: 'Aunt June',
		totalMinutes: 35,
		yieldText: 'Makes 10',
		tags: ['Breakfast', 'Baking'],
		href: sampleRecipeHref,
	},
	{
		title: 'Weeknight chicken soup',
		source: 'Grandpa Lou',
		totalMinutes: 50,
		yieldText: 'Serves 6',
		tags: ['Soup', 'Weeknight'],
		href: sampleRecipeHref,
	},
	{
		title: 'Lemon icebox pie with a graham cracker crust',
		source: 'Grandma Rose',
		totalMinutes: 270,
		yieldText: 'Serves 8',
		tags: ['Dessert', 'Make ahead'],
		href: sampleRecipeHref,
	},
	{
		title: 'Sunday pot roast',
		source: 'Uncle Ray',
		totalMinutes: 225,
		yieldText: 'Serves 8',
		tags: ['Main', 'Slow cooked'],
		href: sampleRecipeHref,
	},
	{
		title: 'Garden tomato salad',
		source: 'Cousin Maya',
		totalMinutes: 15,
		yieldText: 'Serves 4',
		tags: ['Salad', 'Vegetarian', 'Summer'],
		href: sampleRecipeHref,
	},
	{
		title: 'Molasses spice cookies',
		source: 'Great-aunt Edie',
		totalMinutes: 70,
		yieldText: 'Makes 36',
		tags: ['Baking', 'Holiday', 'Freezer friendly'],
		href: sampleRecipeHref,
	},
];

const sampleRecipe: SampleRecipe = {
	title: 'Buttermilk biscuits',
	source: 'Aunt June',
	description:
		'Tall, flaky biscuits that June baked every Sunday morning. Cold butter and a gentle hand do most of the work.',
	meta: [
		{ label: 'Prep', value: '15 min' },
		{ label: 'Cook', value: '18 min' },
		{ label: 'Total', value: '35 min' },
		{ label: 'Yield', value: '10 biscuits' },
	],
	tags: ['Breakfast', 'Baking'],
	ingredientSections: [
		{
			ingredients: [
				{ quantity: '2½ cups', item: 'all-purpose flour' },
				{ quantity: '1 tablespoon', item: 'baking powder' },
				{ quantity: '1 teaspoon', item: 'fine salt' },
				{ quantity: '½ teaspoon', item: 'baking soda' },
				{ quantity: '10 tablespoons', item: 'cold unsalted butter, cubed' },
				{ quantity: '1 cup', item: 'cold buttermilk' },
			],
		},
		{
			heading: 'For the honey butter',
			ingredients: [
				{ quantity: '4 tablespoons', item: 'salted butter, softened' },
				{ quantity: '2 tablespoons', item: 'honey' },
			],
		},
	],
	steps: [
		'Heat the oven to 450°F and line a baking sheet with parchment.',
		'Whisk the flour, baking powder, salt, and baking soda in a large bowl.',
		'Rub the butter into the flour with your fingertips until the pieces are the size of peas.',
		'Stir in the buttermilk with a fork until a shaggy dough forms. Stop as soon as it holds together.',
		'Pat the dough 1 inch thick, fold it in thirds, and pat it out again. Repeat the fold twice.',
		'Cut 2½-inch rounds, set them touching on the sheet, and bake 15 to 18 minutes until golden.',
		'Beat the butter and honey together and serve with the biscuits while they are warm.',
	],
	note: 'June cut her biscuits with a juice glass and never twisted it, because twisting seals the edges and keeps them from rising. She said cold hands make the best biscuits.',
};

export { sampleCourses, sampleRecipe, sampleRecipeCards };
