import type { RecipeContentInput } from '@/domain/recipe/recipe';

// Synthetic recipes for tests, the seed script, and the design reference. Never real family data.

export const sampleChickenAndDumplings: RecipeContentInput = {
	title: 'Chicken and dumplings',
	description:
		'Tender chicken in a thick, peppery gravy under fluffy drop dumplings. A cold-weather supper that feeds a crowd.',
	yield: { kind: 'servings', amount: { min: 6 } },
	times: { prepMinutes: 20, cookMinutes: 40 },
	ingredientSections: [
		{
			heading: 'For the stew',
			lines: [
				{ text: '2 tablespoons butter', amount: { min: 2 }, unit: 'tablespoons', item: 'butter' },
				{ text: '1 onion, diced', amount: { min: 1 }, item: 'onion', preparation: 'diced' },
				{ text: '3 carrots, sliced', amount: { min: 3 }, item: 'carrots', preparation: 'sliced' },
				{
					text: '1½ pounds bone-in chicken thighs',
					amount: { min: 1.5 },
					unit: 'pounds',
					item: 'bone-in chicken thighs',
				},
				{ text: '5 cups chicken broth', amount: { min: 5 }, unit: 'cups', item: 'chicken broth' },
			],
		},
		{
			heading: 'For the dumplings',
			lines: [
				{
					text: '1½ cups all-purpose flour',
					amount: { min: 1.5 },
					unit: 'cups',
					item: 'all-purpose flour',
				},
				{
					text: '2 teaspoons baking powder',
					amount: { min: 2 },
					unit: 'teaspoons',
					item: 'baking powder',
				},
				{ text: '¾ cup milk', amount: { min: 0.75 }, unit: 'cup', item: 'milk' },
			],
		},
	],
	instructionSections: [
		{
			steps: [
				{ text: 'Melt the butter in a wide pot and cook the onion and carrots until soft.' },
				{
					text: 'Add the chicken and broth, cover, and simmer 20 minutes. Lift out the chicken, shred the meat, and return it to the pot.',
				},
				{
					text: 'Stir the flour, baking powder, and a pinch of salt with the milk to a sticky batter.',
				},
				{ text: 'Drop spoonfuls of batter onto the simmering stew and cover tightly.' },
				{
					text: 'Cook 15 minutes without lifting the lid, until the dumplings are puffed and dry inside.',
				},
			],
		},
	],
	chapter: 'main-dishes',
	holidays: [],
	diets: [],
	images: [],
};

export const sampleLemonGarlicRoastChicken: RecipeContentInput = {
	title: 'Lemon garlic roast chicken with potatoes',
	description:
		'A whole chicken rubbed with lemon, garlic, and thyme, roasted over a bed of little potatoes that catch every drip.',
	notes:
		'Aunt June tucked the squeezed lemon halves inside the bird and swore it kept the breast juicy. She served it with plenty of crusty bread for the pan juices.',
	source: 'Aunt June',
	yield: { kind: 'servings', amount: { min: 4 } },
	times: { prepMinutes: 15, cookMinutes: 75 },
	ingredientSections: [
		{
			lines: [
				{
					text: '1 whole chicken, about 4 pounds',
					amount: { min: 1 },
					item: 'whole chicken',
					preparation: 'about 4 pounds',
				},
				{ text: '2 lemons', amount: { min: 2 }, item: 'lemons' },
				{ text: '6 garlic cloves', amount: { min: 6 }, item: 'garlic cloves' },
				{
					text: '1½ pounds small potatoes, halved',
					amount: { min: 1.5 },
					unit: 'pounds',
					item: 'small potatoes',
					preparation: 'halved',
				},
				{
					text: '3 tablespoons olive oil',
					amount: { min: 3 },
					unit: 'tablespoons',
					item: 'olive oil',
				},
				{
					text: '1 tablespoon fresh thyme',
					amount: { min: 1 },
					unit: 'tablespoon',
					item: 'fresh thyme',
				},
			],
		},
	],
	instructionSections: [
		{
			steps: [
				{ text: 'Heat the oven to 425°F and pat the chicken very dry.' },
				{
					text: 'Mash four garlic cloves with the thyme, the zest of one lemon, the oil, and a generous pinch of salt. Rub it all over the chicken.',
				},
				{
					text: 'Toss the potatoes in a roasting pan with the remaining garlic and a little oil. Set the chicken on top with a squeezed lemon half inside.',
				},
				{
					text: 'Roast 70 to 80 minutes, until the juices run clear and the potatoes are browned.',
				},
				{ text: 'Rest the chicken 10 minutes, then squeeze the other lemon over everything.' },
			],
		},
	],
	chapter: 'main-dishes',
	holidays: [],
	diets: ['gluten-free', 'dairy-free'],
	images: [],
};

export const sampleYellowChickenCurry: RecipeContentInput = {
	title: 'Yellow chicken curry with rice',
	description: 'A mild one pot curry with coconut milk, turmeric, and tender chicken thighs.',
	yield: { kind: 'servings', amount: { min: 4 } },
	times: { prepMinutes: 10, cookMinutes: 25 },
	ingredientSections: [
		{
			lines: [
				{
					text: '1 pound boneless chicken thighs, cut into chunks',
					amount: { min: 1 },
					unit: 'pound',
					item: 'boneless chicken thighs',
					preparation: 'cut into chunks',
				},
				{ text: '1 onion, sliced', amount: { min: 1 }, item: 'onion', preparation: 'sliced' },
				{
					text: '2 tablespoons yellow curry powder',
					amount: { min: 2 },
					unit: 'tablespoons',
					item: 'yellow curry powder',
				},
				{
					text: '1 can (14 ounces) coconut milk',
					amount: { min: 1 },
					unit: 'can (14 ounces)',
					item: 'coconut milk',
				},
				{ text: '2 cups cooked rice', amount: { min: 2 }, unit: 'cups', item: 'cooked rice' },
			],
		},
	],
	instructionSections: [
		{
			steps: [
				{
					text: 'Cook the onion in a little oil until golden, then stir in the curry powder for a minute.',
				},
				{ text: 'Add the chicken and brown it lightly on all sides.' },
				{ text: 'Pour in the coconut milk, bring to a gentle simmer, and cook 15 minutes.' },
				{ text: 'Season with salt and serve over the rice.' },
			],
		},
	],
	chapter: 'main-dishes',
	holidays: [],
	diets: ['dairy-free'],
	images: [],
};

export const sampleChickpeaTomatoStew: RecipeContentInput = {
	title: 'Chickpea and tomato stew',
	description:
		'Chickpeas simmered with crushed tomatoes, smoked paprika, and a handful of spinach. It tastes better the next day.',
	source: 'Riverbend Community Cookbook',
	yield: { kind: 'servings', amount: { min: 4 } },
	times: { prepMinutes: 10, cookMinutes: 20 },
	ingredientSections: [
		{
			lines: [
				{
					text: '1 tablespoon olive oil',
					amount: { min: 1 },
					unit: 'tablespoon',
					item: 'olive oil',
				},
				{ text: '1 onion, chopped', amount: { min: 1 }, item: 'onion', preparation: 'chopped' },
				{
					text: '2 cans (15 ounces each) chickpeas, drained',
					amount: { min: 2 },
					unit: 'cans (15 ounces each)',
					item: 'chickpeas',
					preparation: 'drained',
				},
				{
					text: '1 can (28 ounces) crushed tomatoes',
					amount: { min: 1 },
					unit: 'can (28 ounces)',
					item: 'crushed tomatoes',
				},
				{
					text: '1 teaspoon smoked paprika',
					amount: { min: 1 },
					unit: 'teaspoon',
					item: 'smoked paprika',
				},
				{ text: '4 cups spinach', amount: { min: 4 }, unit: 'cups', item: 'spinach' },
			],
		},
	],
	instructionSections: [
		{
			steps: [
				{ text: 'Soften the onion in the oil, then stir in the paprika.' },
				{ text: 'Add the chickpeas and tomatoes and simmer 15 minutes, stirring now and then.' },
				{ text: 'Stir in the spinach until it wilts and season with salt.' },
			],
		},
	],
	chapter: 'main-dishes',
	holidays: [],
	diets: ['vegetarian', 'vegan', 'gluten-free', 'dairy-free'],
	images: [],
};

export const sampleTomatoBasilSoup: RecipeContentInput = {
	title: 'Tomato basil soup',
	description:
		'Smooth and bright, made with canned tomatoes and a big handful of basil stirred in at the end.',
	notes:
		'Lou always served this with grilled cheese cut into strips for dipping, and he swirled in a spoonful of cream if company came.',
	source: 'Grandpa Lou',
	yield: { kind: 'servings', amount: { min: 4 } },
	times: { prepMinutes: 10, cookMinutes: 30 },
	ingredientSections: [
		{
			lines: [
				{ text: '2 tablespoons butter', amount: { min: 2 }, unit: 'tablespoons', item: 'butter' },
				{ text: '1 onion, chopped', amount: { min: 1 }, item: 'onion', preparation: 'chopped' },
				{
					text: '1 can (28 ounces) whole tomatoes',
					amount: { min: 1 },
					unit: 'can (28 ounces)',
					item: 'whole tomatoes',
				},
				{
					text: '2 cups vegetable broth',
					amount: { min: 2 },
					unit: 'cups',
					item: 'vegetable broth',
				},
				{
					text: '½ cup fresh basil leaves',
					amount: { min: 0.5 },
					unit: 'cup',
					item: 'fresh basil leaves',
				},
			],
		},
	],
	instructionSections: [
		{
			steps: [
				{ text: 'Melt the butter in a stockpot and cook the onion until soft, about 8 minutes.' },
				{ text: 'Add the tomatoes and broth and simmer 20 minutes.' },
				{ text: 'Add the basil and blend until smooth, then season with salt and pepper.' },
			],
		},
	],
	chapter: 'soups-salads',
	holidays: [],
	diets: ['vegetarian'],
	images: [],
};

export const sampleSplitPeaSoup: RecipeContentInput = {
	title: 'Split pea soup',
	description: 'A thick green soup with smoky ham hock, carrots, and plenty of black pepper.',
	notes:
		'Lou made a double batch every January and froze it in jars. He said it thickens overnight, so thin it with a splash of water when you reheat it.',
	source: 'Grandpa Lou',
	yield: { kind: 'servings', amount: { min: 8 } },
	times: { prepMinutes: 15, cookMinutes: 90 },
	ingredientSections: [
		{
			lines: [
				{
					text: '1 pound dried split peas',
					amount: { min: 1 },
					unit: 'pound',
					item: 'dried split peas',
				},
				{ text: '1 smoked ham hock', amount: { min: 1 }, item: 'smoked ham hock' },
				{ text: '1 onion, diced', amount: { min: 1 }, item: 'onion', preparation: 'diced' },
				{ text: '2 carrots, diced', amount: { min: 2 }, item: 'carrots', preparation: 'diced' },
				{ text: '8 cups water', amount: { min: 8 }, unit: 'cups', item: 'water' },
				{ text: '2 bay leaves', amount: { min: 2 }, item: 'bay leaves' },
			],
		},
	],
	instructionSections: [
		{
			steps: [
				{
					text: 'Rinse the peas and put them in a large pot with the ham hock, water, and bay leaves.',
				},
				{ text: 'Bring to a boil, skim off the foam, then lower the heat and simmer 30 minutes.' },
				{
					text: 'Add the onion and carrots and simmer another hour, stirring often, until the peas collapse.',
				},
				{
					text: 'Pull the meat from the hock, chop it, and return it to the soup. Remove the bay leaves.',
				},
			],
		},
	],
	chapter: 'soups-salads',
	holidays: [],
	diets: [],
	images: [],
};

export const sampleMinestrone: RecipeContentInput = {
	title: 'Minestrone',
	description:
		'A vegetable soup built on tomatoes, white beans, and small pasta, with a rind of Parmesan simmered in for depth.',
	source: 'Riverbend Community Cookbook',
	yield: { kind: 'servings', amount: { min: 6 } },
	times: { prepMinutes: 15, cookMinutes: 35 },
	ingredientSections: [
		{
			lines: [
				{
					text: '2 tablespoons olive oil',
					amount: { min: 2 },
					unit: 'tablespoons',
					item: 'olive oil',
				},
				{ text: '2 carrots, diced', amount: { min: 2 }, item: 'carrots', preparation: 'diced' },
				{ text: '2 zucchini, diced', amount: { min: 2 }, item: 'zucchini', preparation: 'diced' },
				{
					text: '1 can (14 ounces) diced tomatoes',
					amount: { min: 1 },
					unit: 'can (14 ounces)',
					item: 'diced tomatoes',
				},
				{
					text: '1 can (15 ounces) white beans, drained',
					amount: { min: 1 },
					unit: 'can (15 ounces)',
					item: 'white beans',
					preparation: 'drained',
				},
				{
					text: '6 cups vegetable broth',
					amount: { min: 6 },
					unit: 'cups',
					item: 'vegetable broth',
				},
				{ text: '1 cup small pasta', amount: { min: 1 }, unit: 'cup', item: 'small pasta' },
			],
		},
	],
	instructionSections: [
		{
			steps: [
				{ text: 'Cook the carrots and zucchini in the oil for 5 minutes.' },
				{ text: 'Add the tomatoes, beans, and broth, and simmer 20 minutes.' },
				{ text: 'Stir in the pasta and cook until tender, about 8 minutes.' },
				{ text: 'Season with salt and pepper and serve with grated Parmesan.' },
			],
		},
	],
	chapter: 'soups-salads',
	holidays: [],
	diets: [],
	images: [],
};

export const sampleSausageGravyOverBiscuits: RecipeContentInput = {
	title: 'Sausage gravy over biscuits',
	description:
		'Peppery milk gravy with crumbled breakfast sausage, ladled over split warm biscuits.',
	notes:
		'June stirred the flour into the sausage fat until it smelled toasty before she added any milk. She said that minute of patience is what keeps gravy from tasting like paste.',
	source: 'Aunt June',
	yield: { kind: 'servings', amount: { min: 4 } },
	times: { prepMinutes: 10, cookMinutes: 15 },
	ingredientSections: [
		{
			lines: [
				{
					text: '½ pound breakfast sausage',
					amount: { min: 0.5 },
					unit: 'pound',
					item: 'breakfast sausage',
				},
				{
					text: '3 tablespoons all-purpose flour',
					amount: { min: 3 },
					unit: 'tablespoons',
					item: 'all-purpose flour',
				},
				{ text: '2 cups whole milk', amount: { min: 2 }, unit: 'cups', item: 'whole milk' },
				{
					text: '½ teaspoon black pepper',
					amount: { min: 0.5 },
					unit: 'teaspoon',
					item: 'black pepper',
				},
				{
					text: '4 warm biscuits, split',
					amount: { min: 4 },
					item: 'warm biscuits',
					preparation: 'split',
				},
			],
		},
	],
	instructionSections: [
		{
			steps: [
				{ text: 'Brown the sausage in a skillet, breaking it into small crumbles.' },
				{ text: 'Sprinkle the flour over the sausage and stir for a minute.' },
				{ text: 'Pour in the milk slowly, stirring, and simmer until thick, about 5 minutes.' },
				{ text: 'Add the pepper and salt to taste, then spoon over the split biscuits.' },
			],
		},
	],
	chapter: 'breakfast-brunch',
	holidays: [],
	diets: [],
	images: [],
};

export const sampleTomatoTart: RecipeContentInput = {
	title: 'Tomato tart with crème fraîche and basil',
	description:
		'A crisp puff pastry base spread with crème fraîche and mustard, topped with sliced tomatoes and torn basil.',
	notes:
		'Hélène salted the tomato slices and let them drain on a towel first, so the pastry stays crisp instead of soggy.',
	source: 'Tante Hélène',
	yield: { kind: 'servings', amount: { min: 6 } },
	times: { prepMinutes: 20, cookMinutes: 35 },
	ingredientSections: [
		{
			lines: [
				{
					text: '1 sheet puff pastry, thawed',
					amount: { min: 1 },
					unit: 'sheet',
					item: 'puff pastry',
					preparation: 'thawed',
				},
				{
					text: '½ cup crème fraîche',
					amount: { min: 0.5 },
					unit: 'cup',
					item: 'crème fraîche',
				},
				{
					text: '1 tablespoon Dijon mustard',
					amount: { min: 1 },
					unit: 'tablespoon',
					item: 'Dijon mustard',
				},
				{
					text: '1½ pounds ripe tomatoes, sliced',
					amount: { min: 1.5 },
					unit: 'pounds',
					item: 'ripe tomatoes',
					preparation: 'sliced',
				},
				{
					text: '¼ cup basil leaves, torn',
					amount: { min: 0.25 },
					unit: 'cup',
					item: 'basil leaves',
					preparation: 'torn',
				},
			],
		},
	],
	instructionSections: [
		{
			steps: [
				{
					text: 'Heat the oven to 400°F. Lay the pastry on a lined baking sheet and prick it all over.',
				},
				{
					text: 'Stir the crème fraîche and mustard together and spread it over the pastry, leaving a border.',
				},
				{ text: 'Arrange the tomato slices in overlapping rows and season with salt and pepper.' },
				{
					text: 'Bake 30 to 35 minutes until the edges are deep golden, then scatter the basil on top.',
				},
			],
		},
	],
	chapter: 'vegetables-sides',
	holidays: [],
	diets: ['vegetarian'],
	images: [],
};

export const sampleBlackBeanChili: RecipeContentInput = {
	title: 'Black bean chili',
	description:
		'A smoky, meatless chili with black beans, tomatoes, and cumin, ready in under an hour.',
	yield: { kind: 'servings', amount: { min: 6 } },
	times: { prepMinutes: 15, cookMinutes: 40 },
	ingredientSections: [
		{
			lines: [
				{
					text: '1 tablespoon olive oil',
					amount: { min: 1 },
					unit: 'tablespoon',
					item: 'olive oil',
				},
				{ text: '1 onion, diced', amount: { min: 1 }, item: 'onion', preparation: 'diced' },
				{
					text: '2 tablespoons chili powder',
					amount: { min: 2 },
					unit: 'tablespoons',
					item: 'chili powder',
				},
				{ text: '2 teaspoons cumin', amount: { min: 2 }, unit: 'teaspoons', item: 'cumin' },
				{
					text: '3 cans (15 ounces each) black beans',
					amount: { min: 3 },
					unit: 'cans (15 ounces each)',
					item: 'black beans',
				},
				{
					text: '1 can (14 ounces) diced tomatoes',
					amount: { min: 1 },
					unit: 'can (14 ounces)',
					item: 'diced tomatoes',
				},
			],
		},
	],
	instructionSections: [
		{
			steps: [
				{ text: 'Cook the onion in the oil until soft, then stir in the chili powder and cumin.' },
				{ text: 'Add the beans with their liquid and the tomatoes.' },
				{ text: 'Simmer 30 minutes, mashing a few beans against the side to thicken it.' },
				{ text: 'Season with salt and serve with sour cream and chopped scallions.' },
			],
		},
	],
	chapter: 'main-dishes',
	holidays: [],
	diets: ['vegetarian'],
	images: [],
};

export const sampleRoastedCarrotGingerSoup: RecipeContentInput = {
	title: 'Roasted carrot ginger soup',
	description: 'Carrots roasted until sweet, then blended with fresh ginger and a little cream.',
	yield: { kind: 'servings', amount: { min: 4 } },
	times: { prepMinutes: 15, cookMinutes: 40 },
	ingredientSections: [
		{
			lines: [
				{
					text: '2 pounds carrots, chopped',
					amount: { min: 2 },
					unit: 'pounds',
					item: 'carrots',
					preparation: 'chopped',
				},
				{
					text: '2 tablespoons olive oil',
					amount: { min: 2 },
					unit: 'tablespoons',
					item: 'olive oil',
				},
				{
					text: '2 tablespoons grated fresh ginger',
					amount: { min: 2 },
					unit: 'tablespoons',
					item: 'grated fresh ginger',
				},
				{
					text: '4 cups vegetable broth',
					amount: { min: 4 },
					unit: 'cups',
					item: 'vegetable broth',
				},
				{ text: '¼ cup heavy cream', amount: { min: 0.25 }, unit: 'cup', item: 'heavy cream' },
			],
		},
	],
	instructionSections: [
		{
			steps: [
				{
					text: 'Roast the carrots with the oil at 425°F for 25 minutes until browned at the edges.',
				},
				{ text: 'Move them to a saucepan with the ginger and broth and simmer 10 minutes.' },
				{ text: 'Blend until smooth, stir in the cream, and season with salt.' },
			],
		},
	],
	chapter: 'soups-salads',
	holidays: [],
	diets: ['vegetarian'],
	images: [],
};
