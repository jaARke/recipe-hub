import type { RecipeContentInput } from '@/domain/recipe/recipe';

// Synthetic recipes for tests, the seed script, and the design reference. Never real family data.

export const sampleCremeBrulee: RecipeContentInput = {
	title: 'Crème brûlée',
	description:
		'A silky vanilla custard under a thin sheet of burnt sugar that cracks under the spoon.',
	notes:
		'Hélène baked the custards in a water bath with the oven door cracked at the end, so they set gently and never curdled. The chilling time is not optional.',
	source: 'Tante Hélène',
	yield: { kind: 'servings', amount: { min: 6 } },
	times: { prepMinutes: 15, cookMinutes: 45, totalMinutes: 300 },
	ingredientSections: [
		{
			lines: [
				{ text: '3 cups heavy cream', amount: { min: 3 }, unit: 'cups', item: 'heavy cream' },
				{
					text: '1 vanilla bean, split',
					amount: { min: 1 },
					item: 'vanilla bean',
					preparation: 'split',
				},
				{ text: '6 egg yolks', amount: { min: 6 }, item: 'egg yolks' },
				{ text: '½ cup sugar', amount: { min: 0.5 }, unit: 'cup', item: 'sugar' },
				{
					text: '6 tablespoons sugar for the tops',
					amount: { min: 6 },
					unit: 'tablespoons',
					item: 'sugar',
					preparation: 'for the tops',
				},
			],
		},
	],
	instructionSections: [
		{
			steps: [
				{
					text: 'Heat the oven to 325°F. Warm the cream with the vanilla seeds and pod, then steep 15 minutes.',
				},
				{
					text: 'Whisk the yolks and sugar, then slowly whisk in the warm cream and strain it into six ramekins.',
				},
				{
					text: 'Set the ramekins in a pan of hot water and bake 40 to 45 minutes until the centers just wobble.',
				},
				{ text: 'Chill at least 4 hours.' },
				{
					text: 'Sprinkle each custard with a spoonful of sugar and caramelize it with a torch or under the broiler.',
				},
			],
		},
	],
	tags: ['Dessert', 'Français', 'Make ahead'],
	images: [],
};

export const sampleEclairs: RecipeContentInput = {
	title: 'Éclairs with chocolate glaze',
	description:
		'Light choux pastry filled with vanilla pastry cream and dipped in a glossy dark chocolate glaze.',
	source: 'Tante Hélène',
	yield: { kind: 'makes', amount: { min: 12 }, unit: 'éclairs' },
	times: { prepMinutes: 40, cookMinutes: 35 },
	ingredientSections: [
		{
			heading: 'For the pastry',
			lines: [
				{ text: '1 cup water', amount: { min: 1 }, unit: 'cup', item: 'water' },
				{ text: '6 tablespoons butter', amount: { min: 6 }, unit: 'tablespoons', item: 'butter' },
				{
					text: '1 cup all-purpose flour',
					amount: { min: 1 },
					unit: 'cup',
					item: 'all-purpose flour',
				},
				{ text: '4 eggs', amount: { min: 4 }, item: 'eggs' },
			],
		},
		{
			heading: 'For the filling and glaze',
			lines: [
				{
					text: '2 cups vanilla pastry cream',
					amount: { min: 2 },
					unit: 'cups',
					item: 'vanilla pastry cream',
				},
				{
					text: '4 ounces dark chocolate, chopped',
					amount: { min: 4 },
					unit: 'ounces',
					item: 'dark chocolate',
					preparation: 'chopped',
				},
				{ text: '½ cup heavy cream', amount: { min: 0.5 }, unit: 'cup', item: 'heavy cream' },
			],
		},
	],
	instructionSections: [
		{
			steps: [
				{
					text: 'Heat the oven to 400°F. Boil the water and butter, then beat in the flour until a smooth ball forms.',
				},
				{ text: 'Cool the dough 5 minutes, then beat in the eggs one at a time until glossy.' },
				{
					text: 'Pipe 4-inch fingers onto lined sheets and bake 30 to 35 minutes until deep golden. Cool completely.',
				},
				{ text: 'Split the éclairs and fill them with the pastry cream.' },
				{
					text: 'Warm the cream, pour it over the chocolate, stir until smooth, and dip the tops.',
				},
			],
		},
	],
	tags: ['Dessert', 'Baking', 'Holiday'],
	images: [],
};

export const sampleJalapenoCornbread: RecipeContentInput = {
	title: 'Jalapeño cornbread',
	description: 'Golden skillet cornbread with diced jalapeño and sharp cheddar folded in.',
	source: 'Riverbend Community Cookbook',
	yield: { kind: 'servings', amount: { min: 8 } },
	times: { prepMinutes: 10, cookMinutes: 25 },
	ingredientSections: [
		{
			lines: [
				{ text: '1½ cups cornmeal', amount: { min: 1.5 }, unit: 'cups', item: 'cornmeal' },
				{
					text: '1 cup all-purpose flour',
					amount: { min: 1 },
					unit: 'cup',
					item: 'all-purpose flour',
				},
				{
					text: '1 tablespoon baking powder',
					amount: { min: 1 },
					unit: 'tablespoon',
					item: 'baking powder',
				},
				{ text: '1½ cups buttermilk', amount: { min: 1.5 }, unit: 'cups', item: 'buttermilk' },
				{ text: '2 eggs', amount: { min: 2 }, item: 'eggs' },
				{
					text: '2 jalapeños, seeded and diced',
					amount: { min: 2 },
					item: 'jalapeños',
					preparation: 'seeded and diced',
				},
				{
					text: '1 cup shredded sharp cheddar',
					amount: { min: 1 },
					unit: 'cup',
					item: 'shredded sharp cheddar',
				},
			],
		},
	],
	instructionSections: [
		{
			steps: [
				{ text: 'Heat the oven to 425°F with a buttered cast iron skillet inside.' },
				{ text: 'Whisk the cornmeal, flour, baking powder, and a teaspoon of salt.' },
				{ text: 'Stir in the buttermilk and eggs, then fold in the jalapeños and cheddar.' },
				{ text: 'Pour into the hot skillet and bake 22 to 25 minutes until golden and set.' },
			],
		},
	],
	tags: ['Baking', 'Side'],
	images: [],
};

export const sampleLemonBars: RecipeContentInput = {
	title: 'Lemon bars',
	description:
		'A buttery shortbread crust under a tart lemon curd, dusted with powdered sugar once they are cold.',
	notes:
		'Rose chilled the pan until the filling was completely firm before she cut it, and wiped the knife clean between every slice.',
	source: 'Grandma Rose',
	yield: { kind: 'makes', amount: { min: 16 }, unit: 'bars' },
	times: { prepMinutes: 15, cookMinutes: 30, totalMinutes: 120 },
	ingredientSections: [
		{
			heading: 'For the crust',
			lines: [
				{
					text: '1 cup butter, softened',
					amount: { min: 1 },
					unit: 'cup',
					item: 'butter',
					preparation: 'softened',
				},
				{
					text: '2 cups all-purpose flour',
					amount: { min: 2 },
					unit: 'cups',
					item: 'all-purpose flour',
				},
				{ text: '½ cup powdered sugar', amount: { min: 0.5 }, unit: 'cup', item: 'powdered sugar' },
			],
		},
		{
			heading: 'For the filling',
			lines: [
				{ text: '4 eggs', amount: { min: 4 }, item: 'eggs' },
				{ text: '1½ cups sugar', amount: { min: 1.5 }, unit: 'cups', item: 'sugar' },
				{
					text: '½ cup fresh lemon juice',
					amount: { min: 0.5 },
					unit: 'cup',
					item: 'fresh lemon juice',
				},
				{
					text: '2 tablespoons lemon zest',
					amount: { min: 2 },
					unit: 'tablespoons',
					item: 'lemon zest',
				},
			],
		},
	],
	instructionSections: [
		{
			steps: [
				{
					text: 'Heat the oven to 350°F. Mix the butter, flour, and powdered sugar and press into a lined 9-inch square pan.',
				},
				{ text: 'Bake the crust 20 minutes, until lightly golden.' },
				{ text: 'Whisk the eggs, sugar, lemon juice, and zest and pour over the warm crust.' },
				{
					text: 'Bake 15 minutes more, until the filling is set. Cool, then chill before cutting.',
				},
			],
		},
	],
	tags: ['Dessert', 'Baking'],
	images: [],
};

export const sampleOatmealRaisinCookies: RecipeContentInput = {
	title: 'Oatmeal raisin cookies',
	description: 'Chewy cookies with rolled oats, plump raisins, and a little cinnamon.',
	source: 'Cousin Maya',
	yield: { kind: 'makes', amount: { min: 24 }, unit: 'cookies' },
	times: { prepMinutes: 15, cookMinutes: 12 },
	ingredientSections: [
		{
			lines: [
				{
					text: '1 cup butter, softened',
					amount: { min: 1 },
					unit: 'cup',
					item: 'butter',
					preparation: 'softened',
				},
				{ text: '1 cup brown sugar', amount: { min: 1 }, unit: 'cup', item: 'brown sugar' },
				{ text: '2 eggs', amount: { min: 2 }, item: 'eggs' },
				{
					text: '1½ cups all-purpose flour',
					amount: { min: 1.5 },
					unit: 'cups',
					item: 'all-purpose flour',
				},
				{ text: '3 cups rolled oats', amount: { min: 3 }, unit: 'cups', item: 'rolled oats' },
				{ text: '1 cup raisins', amount: { min: 1 }, unit: 'cup', item: 'raisins' },
				{ text: '1 teaspoon cinnamon', amount: { min: 1 }, unit: 'teaspoon', item: 'cinnamon' },
			],
		},
	],
	instructionSections: [
		{
			steps: [
				{
					text: 'Heat the oven to 350°F. Beat the butter and brown sugar until fluffy, then beat in the eggs.',
				},
				{
					text: 'Stir in the flour, cinnamon, and a half teaspoon of baking soda, then the oats and raisins.',
				},
				{
					text: 'Drop rounded spoonfuls onto lined sheets and bake 10 to 12 minutes until the edges are set.',
				},
			],
		},
	],
	tags: ['Baking', 'Dessert', 'Freezer friendly'],
	images: [],
};

export const sampleBrownButterChocolateChipCookies: RecipeContentInput = {
	title: 'Chocolate chip cookies with brown butter',
	description:
		'Brown butter gives these cookies a toasty, nutty flavor, and chopped chocolate melts into puddles.',
	yield: { kind: 'makes', amount: { min: 30 }, unit: 'cookies' },
	times: { prepMinutes: 20, cookMinutes: 12 },
	ingredientSections: [
		{
			lines: [
				{
					text: '1 cup brown butter, cooled',
					amount: { min: 1 },
					unit: 'cup',
					item: 'brown butter',
					preparation: 'cooled',
				},
				{ text: '¾ cup brown sugar', amount: { min: 0.75 }, unit: 'cup', item: 'brown sugar' },
				{ text: '1 egg plus 1 yolk', amount: { min: 1 }, item: 'egg plus 1 yolk' },
				{
					text: '2¼ cups all-purpose flour',
					amount: { min: 2.25 },
					unit: 'cups',
					item: 'all-purpose flour',
				},
				{
					text: '8 ounces chocolate, chopped',
					amount: { min: 8 },
					unit: 'ounces',
					item: 'chocolate',
					preparation: 'chopped',
				},
			],
		},
	],
	instructionSections: [
		{
			steps: [
				{
					text: 'Melt the butter in a pan and cook, swirling, until it smells nutty and flecks turn amber. Cool 15 minutes.',
				},
				{
					text: 'Whisk the brown butter with the sugar, egg, and yolk. Stir in the flour, a teaspoon of salt, and a half teaspoon of baking soda.',
				},
				{ text: 'Fold in the chocolate and scoop onto lined sheets.' },
				{ text: 'Bake at 350°F for 10 to 12 minutes, until the edges are golden.' },
			],
		},
	],
	tags: ['Baking', 'Dessert'],
	images: [],
};

export const samplePeachCobbler: RecipeContentInput = {
	title: 'Peach cobbler with biscuit topping',
	description:
		'Ripe peaches bubbling under a tender, sugar-dusted biscuit topping. June made it all summer long.',
	source: 'Aunt June',
	yield: { kind: 'servings', amount: { min: 8 } },
	times: { prepMinutes: 20, cookMinutes: 45 },
	ingredientSections: [
		{
			heading: 'For the filling',
			lines: [
				{
					text: '6 ripe peaches, sliced',
					amount: { min: 6 },
					item: 'ripe peaches',
					preparation: 'sliced',
				},
				{ text: '½ cup sugar', amount: { min: 0.5 }, unit: 'cup', item: 'sugar' },
				{
					text: '1 tablespoon cornstarch',
					amount: { min: 1 },
					unit: 'tablespoon',
					item: 'cornstarch',
				},
			],
		},
		{
			heading: 'For the biscuit topping',
			lines: [
				{
					text: '1½ cups all-purpose flour',
					amount: { min: 1.5 },
					unit: 'cups',
					item: 'all-purpose flour',
				},
				{
					text: '1 tablespoon baking powder',
					amount: { min: 1 },
					unit: 'tablespoon',
					item: 'baking powder',
				},
				{
					text: '6 tablespoons cold butter, cubed',
					amount: { min: 6 },
					unit: 'tablespoons',
					item: 'cold butter',
					preparation: 'cubed',
				},
				{ text: '¾ cup cream', amount: { min: 0.75 }, unit: 'cup', item: 'cream' },
			],
		},
	],
	instructionSections: [
		{
			steps: [
				{
					text: 'Heat the oven to 375°F. Toss the peaches with the sugar and cornstarch and spread them in a baking dish.',
				},
				{ text: 'Whisk the flour and baking powder, then rub in the butter until crumbly.' },
				{ text: 'Stir in the cream until a soft dough forms and drop spoonfuls over the peaches.' },
				{
					text: 'Bake 40 to 45 minutes until the topping is golden and the fruit bubbles at the edges.',
				},
			],
		},
	],
	tags: ['Dessert', 'Baking', 'Summer'],
	images: [],
};

export const sampleOvernightCinnamonRolls: RecipeContentInput = {
	title: 'Overnight cinnamon rolls',
	description:
		'Soft yeast rolls with a cinnamon brown sugar swirl, risen slowly in the refrigerator overnight.',
	notes:
		'Edie shaped the rolls the night before Christmas and baked them while the family opened presents. Cream cheese icing goes on while they are still warm.',
	source: 'Great-aunt Edie',
	yield: { kind: 'makes', amount: { min: 12 }, unit: 'rolls' },
	times: { prepMinutes: 40, cookMinutes: 25, totalMinutes: 600 },
	ingredientSections: [
		{
			lines: [
				{
					text: '4 cups all-purpose flour',
					amount: { min: 4 },
					unit: 'cups',
					item: 'all-purpose flour',
				},
				{
					text: '2¼ teaspoons instant yeast',
					amount: { min: 2.25 },
					unit: 'teaspoons',
					item: 'instant yeast',
				},
				{ text: '1 cup warm milk', amount: { min: 1 }, unit: 'cup', item: 'warm milk' },
				{
					text: '½ cup butter, softened',
					amount: { min: 0.5 },
					unit: 'cup',
					item: 'butter',
					preparation: 'softened',
				},
				{ text: '¾ cup brown sugar', amount: { min: 0.75 }, unit: 'cup', item: 'brown sugar' },
				{
					text: '2 tablespoons cinnamon',
					amount: { min: 2 },
					unit: 'tablespoons',
					item: 'cinnamon',
				},
			],
		},
	],
	instructionSections: [
		{
			steps: [
				{
					text: 'Mix the flour, yeast, warm milk, half the butter, and a teaspoon of salt, then knead until smooth.',
				},
				{ text: 'Let the dough rise an hour, then roll it into a large rectangle.' },
				{
					text: 'Spread with the remaining butter, brown sugar, and cinnamon, roll up tightly, and cut into 12 rolls.',
				},
				{ text: 'Set the rolls in a buttered pan, cover, and refrigerate overnight.' },
				{ text: 'Bake at 350°F for 22 to 25 minutes until golden.' },
			],
		},
	],
	tags: ['Breakfast', 'Baking', 'Holiday'],
	images: [],
};

export const sampleZucchiniBread: RecipeContentInput = {
	title: 'Zucchini bread',
	description: 'A moist spiced loaf made with grated zucchini and chopped walnuts.',
	source: 'Cousin Maya',
	yield: { kind: 'makes', amount: { min: 1 }, unit: 'loaf' },
	times: { prepMinutes: 20, cookMinutes: 60 },
	ingredientSections: [
		{
			lines: [
				{
					text: '2 cups grated zucchini',
					amount: { min: 2 },
					unit: 'cups',
					item: 'grated zucchini',
				},
				{ text: '3 eggs', amount: { min: 3 }, item: 'eggs' },
				{ text: '1 cup sugar', amount: { min: 1 }, unit: 'cup', item: 'sugar' },
				{ text: '½ cup vegetable oil', amount: { min: 0.5 }, unit: 'cup', item: 'vegetable oil' },
				{
					text: '2½ cups all-purpose flour',
					amount: { min: 2.5 },
					unit: 'cups',
					item: 'all-purpose flour',
				},
				{ text: '1 cup chopped walnuts', amount: { min: 1 }, unit: 'cup', item: 'chopped walnuts' },
			],
		},
	],
	instructionSections: [
		{
			steps: [
				{ text: 'Heat the oven to 350°F and grease a loaf pan.' },
				{ text: 'Beat the eggs, sugar, and oil, then stir in the zucchini.' },
				{
					text: 'Fold in the flour, a teaspoon each of baking soda and cinnamon, and the walnuts.',
				},
				{ text: 'Bake 55 to 60 minutes until a skewer comes out clean.' },
			],
		},
	],
	tags: ['Baking', 'Breakfast'],
	images: [],
};

export const sampleVanillaRicePudding: RecipeContentInput = {
	title: 'Vanilla rice pudding',
	description: 'Creamy stovetop rice pudding with vanilla and a pinch of nutmeg.',
	yield: { kind: 'servings', amount: { min: 4 } },
	times: { prepMinutes: 5, cookMinutes: 30 },
	ingredientSections: [
		{
			lines: [
				{ text: '½ cup white rice', amount: { min: 0.5 }, unit: 'cup', item: 'white rice' },
				{ text: '3 cups whole milk', amount: { min: 3 }, unit: 'cups', item: 'whole milk' },
				{ text: '⅓ cup sugar', amount: { min: 1 / 3 }, unit: 'cup', item: 'sugar' },
				{
					text: '2 teaspoons vanilla extract',
					amount: { min: 2 },
					unit: 'teaspoons',
					item: 'vanilla extract',
				},
			],
		},
	],
	instructionSections: [
		{
			steps: [
				{ text: 'Combine the rice, milk, sugar, and a pinch of salt in a saucepan.' },
				{
					text: 'Simmer over low heat, stirring often, until the rice is tender and the pudding is thick, about 30 minutes.',
				},
				{ text: 'Stir in the vanilla and serve warm or chilled with a little nutmeg.' },
			],
		},
	],
	tags: ['Dessert'],
	images: [],
};
