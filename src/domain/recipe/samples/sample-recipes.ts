import type { RecipeContentInput } from '@/domain/recipe/recipe';

// Synthetic recipes for tests, the seed script, and the design reference. Never real family data.

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
	images: [
		{
			role: 'dish',
			pathname: 'dish/seed/buttermilk-biscuits.jpg',
			alt: 'A split biscuit on a blue-rimmed plate with honey drizzled from a spoon',
		},
	],
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
	images: [
		{
			role: 'dish',
			pathname: 'dish/seed/weeknight-chicken-soup.jpg',
			alt: 'A square white bowl of chicken noodle soup with carrots and peppers',
		},
	],
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

export const sampleSundayPotRoast: RecipeContentInput = {
	title: 'Sunday pot roast',
	description:
		'Beef chuck braised low and slow with onions, carrots, and potatoes until it yields to a fork. Ray put it in the oven after breakfast, and by noon the whole house smelled of it.',
	notes:
		'Ray seared the roast longer than anyone thought he should, because the dark crust is where the gravy gets its flavor. He saved every drop of leftover gravy for hot roast beef sandwiches on Monday.',
	source: 'Uncle Ray',
	yield: { kind: 'servings', amount: { min: 8 } },
	times: { prepMinutes: 25, cookMinutes: 200, totalMinutes: 225 },
	ingredientSections: [
		{
			heading: 'For the roast',
			lines: [
				{
					text: '3½ to 4 pounds beef chuck roast',
					amount: { min: 3.5, max: 4 },
					unit: 'pounds',
					item: 'beef chuck roast',
				},
				{
					text: '2 teaspoons kosher salt',
					amount: { min: 2 },
					unit: 'teaspoons',
					item: 'kosher salt',
				},
				{
					text: '1 teaspoon black pepper',
					amount: { min: 1 },
					unit: 'teaspoon',
					item: 'black pepper',
				},
				{
					text: '2 tablespoons vegetable oil',
					amount: { min: 2 },
					unit: 'tablespoons',
					item: 'vegetable oil',
				},
				{
					text: '2 yellow onions, cut into wedges',
					amount: { min: 2 },
					item: 'yellow onions',
					preparation: 'cut into wedges',
				},
				{
					text: '4 garlic cloves, smashed',
					amount: { min: 4 },
					unit: 'cloves',
					item: 'garlic',
					preparation: 'smashed',
				},
				{
					text: '2 tablespoons tomato paste',
					amount: { min: 2 },
					unit: 'tablespoons',
					item: 'tomato paste',
				},
				{ text: '1 cup dry red wine', amount: { min: 1 }, unit: 'cup', item: 'dry red wine' },
				{ text: '2 cups beef broth', amount: { min: 2 }, unit: 'cups', item: 'beef broth' },
				{ text: '3 sprigs fresh thyme', amount: { min: 3 }, unit: 'sprigs', item: 'fresh thyme' },
				{ text: '2 bay leaves', amount: { min: 2 }, item: 'bay leaves' },
				{
					text: '1 pound carrots, cut into 2-inch pieces',
					amount: { min: 1 },
					unit: 'pound',
					item: 'carrots',
					preparation: 'cut into 2-inch pieces',
				},
				{
					text: '1½ pounds small yellow potatoes, halved',
					amount: { min: 1.5 },
					unit: 'pounds',
					item: 'small yellow potatoes',
					preparation: 'halved',
				},
			],
		},
		{
			heading: 'For the gravy',
			lines: [
				{
					text: '2 tablespoons butter, softened',
					amount: { min: 2 },
					unit: 'tablespoons',
					item: 'butter',
					preparation: 'softened',
				},
				{
					text: '2 tablespoons all-purpose flour',
					amount: { min: 2 },
					unit: 'tablespoons',
					item: 'all-purpose flour',
				},
				{
					text: 'Salt and black pepper to taste',
					item: 'salt and black pepper',
					preparation: 'to taste',
				},
			],
		},
	],
	instructionSections: [
		{
			heading: 'For the roast',
			steps: [
				{
					text: 'Heat the oven to 300°F. Pat the roast dry and season it all over with the salt and pepper.',
				},
				{
					text: 'Warm the oil in a large Dutch oven over medium-high heat and sear the roast until deeply browned on every side, about 15 minutes. Set it on a plate.',
				},
				{
					text: 'Lower the heat to medium and cook the onions until they start to brown, about 5 minutes. Stir in the garlic and tomato paste and cook 1 minute more.',
				},
				{
					text: 'Pour in the wine and scrape up the browned bits, then add the broth, thyme, and bay leaves. Return the roast and its juices to the pot.',
				},
				{ text: 'Cover and braise in the oven for 2 hours.' },
				{
					text: 'Tuck the carrots and potatoes around the roast, cover, and braise until the meat is fork-tender, about 1 hour more.',
				},
				{
					text: 'Lift the roast and vegetables onto a platter, cover loosely with foil, and let rest while you make the gravy.',
				},
			],
		},
		{
			heading: 'For the gravy',
			steps: [
				{ text: 'Discard the thyme and bay leaves and skim the fat from the braising liquid.' },
				{
					text: 'Mash the butter and flour into a paste. Bring the liquid to a simmer and whisk in the paste a little at a time until the gravy coats a spoon, about 5 minutes.',
				},
				{
					text: 'Season with salt and pepper. Slice the roast across the grain and serve with the vegetables and gravy.',
				},
			],
		},
	],
	tags: ['Main', 'Slow cooked'],
	images: [
		{
			role: 'dish',
			pathname: 'dish/seed/sunday-pot-roast.jpg',
			alt: 'Sliced roast beef with gravy, mashed potatoes, and mixed vegetables on a plate',
		},
	],
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
	images: [
		{
			role: 'dish',
			pathname: 'dish/seed/garden-tomato-salad.jpg',
			alt: 'Sliced tomatoes dressed with olive oil and a sprig of parsley in a white dish',
		},
	],
};

export const sampleMolassesSpiceCookies: RecipeContentInput = {
	title: 'Molasses spice cookies',
	description:
		'Soft, crackle-topped cookies rolled in sugar, with plenty of ginger and cinnamon. Edie baked them by the tinful every December.',
	notes:
		'Edie kept a bag of dough balls in the freezer all winter and baked a dozen whenever company called. Roll them in sugar straight from the freezer and add 2 minutes to the bake.',
	source: 'Great-aunt Edie',
	yield: { kind: 'makes', amount: { min: 36 }, unit: 'cookies' },
	times: { prepMinutes: 20, cookMinutes: 20, totalMinutes: 70 },
	ingredientSections: [
		{
			lines: [
				{
					text: '2¼ cups all-purpose flour',
					amount: { min: 2.25 },
					unit: 'cups',
					item: 'all-purpose flour',
				},
				{
					text: '2 teaspoons baking soda',
					amount: { min: 2 },
					unit: 'teaspoons',
					item: 'baking soda',
				},
				{
					text: '2 teaspoons ground ginger',
					amount: { min: 2 },
					unit: 'teaspoons',
					item: 'ground ginger',
				},
				{
					text: '1 teaspoon ground cinnamon',
					amount: { min: 1 },
					unit: 'teaspoon',
					item: 'ground cinnamon',
				},
				{
					text: '½ teaspoon ground cloves',
					amount: { min: 0.5 },
					unit: 'teaspoon',
					item: 'ground cloves',
				},
				{ text: '½ teaspoon fine salt', amount: { min: 0.5 }, unit: 'teaspoon', item: 'fine salt' },
				{
					text: '¾ cup unsalted butter, softened',
					amount: { min: 0.75 },
					unit: 'cup',
					item: 'unsalted butter',
					preparation: 'softened',
				},
				{
					text: '1 cup packed dark brown sugar',
					amount: { min: 1 },
					unit: 'cup',
					item: 'dark brown sugar',
					preparation: 'packed',
				},
				{ text: '1 large egg', amount: { min: 1 }, item: 'large egg' },
				{
					text: '¼ cup unsulphured molasses',
					amount: { min: 0.25 },
					unit: 'cup',
					item: 'unsulphured molasses',
				},
			],
		},
		{
			heading: 'For rolling',
			lines: [
				{
					text: '½ cup granulated sugar',
					amount: { min: 0.5 },
					unit: 'cup',
					item: 'granulated sugar',
				},
			],
		},
	],
	instructionSections: [
		{
			steps: [
				{ text: 'Whisk the flour, baking soda, ginger, cinnamon, cloves, and salt in a bowl.' },
				{
					text: 'Beat the butter and brown sugar until fluffy, about 3 minutes. Beat in the egg, then the molasses.',
				},
				{
					text: 'Stir in the flour mixture on low speed until no dry streaks remain. Cover and chill the dough for 30 minutes.',
				},
				{ text: 'Heat the oven to 350°F and line two baking sheets with parchment.' },
				{
					text: 'Roll the dough into 1-inch balls, roll each in the sugar, and set them 2 inches apart.',
				},
				{
					text: 'Bake one sheet at a time until the tops crackle and the centers still look soft, 9 to 10 minutes. Cool on the sheet for 5 minutes.',
				},
			],
		},
	],
	tags: ['Baking', 'Holiday', 'Freezer friendly'],
	images: [],
};

export const sampleRecipeContents: readonly RecipeContentInput[] = [
	sampleButtermilkBiscuits,
	sampleChickenSoup,
	sampleLemonIceboxPie,
	sampleSundayPotRoast,
	sampleTomatoSalad,
	sampleMolassesSpiceCookies,
];
