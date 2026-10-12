import type { RecipeSearchFacets } from '@/application/ports/recipe-search';

// Synthetic sample content for the design reference. Never real user data.

type SampleOption = {
	value: string;
	label: string;
};

export const sampleCourses: readonly SampleOption[] = [
	{ value: 'breakfast', label: 'Breakfast' },
	{ value: 'main', label: 'Main' },
	{ value: 'side', label: 'Side' },
	{ value: 'soup', label: 'Soup' },
	{ value: 'dessert', label: 'Dessert' },
	{ value: 'baking', label: 'Baking' },
];

// A search for "butter" among baking recipes, counted over its four results.
export const sampleSearchFacets: RecipeSearchFacets = {
	tags: [
		{ label: 'Baking', count: 4 },
		{ label: 'Dessert', count: 2 },
		{ label: 'Freezer friendly', count: 2 },
		{ label: 'Breakfast', count: 1 },
		{ label: 'Holiday', count: 1 },
	],
	sources: [
		{ label: 'Aunt June', count: 1 },
		{ label: 'Cousin Maya', count: 1 },
		{ label: 'Great-aunt Edie', count: 1 },
	],
};

// Every sample recipe, with more tags than the filters show before folding the rest away.
export const sampleCatalogFacets: RecipeSearchFacets = {
	tags: [
		{ label: 'Baking', count: 10 },
		{ label: 'Vegetarian', count: 9 },
		{ label: 'Dessert', count: 8 },
		{ label: 'Make ahead', count: 6 },
		{ label: 'Dinner', count: 5 },
		{ label: 'Soup', count: 5 },
		{ label: 'Breakfast', count: 4 },
		{ label: 'Summer', count: 4 },
		{ label: 'Freezer friendly', count: 3 },
		{ label: 'Holiday', count: 3 },
		{ label: 'Weeknight', count: 3 },
		{ label: 'Français', count: 2 },
		{ label: 'Main', count: 2 },
		{ label: 'Salad', count: 2 },
		{ label: 'Appetizer', count: 1 },
		{ label: 'Comfort food', count: 1 },
		{ label: 'Side', count: 1 },
		{ label: 'Slow cooked', count: 1 },
	],
	sources: [
		{ label: 'Aunt June', count: 4 },
		{ label: 'Cousin Maya', count: 3 },
		{ label: 'Grandpa Lou', count: 3 },
		{ label: 'Riverbend Community Cookbook', count: 3 },
		{ label: 'Tante Hélène', count: 3 },
		{ label: 'Grandma Rose', count: 2 },
		{ label: 'Great-aunt Edie', count: 2 },
		{ label: 'Uncle Ray', count: 1 },
	],
};
