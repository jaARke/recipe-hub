import { z } from 'zod';
import { slugKey } from '@/domain/recipe/slug';

// A family cookbook's dividers, in its order. Every recipe is in exactly one.
export const chapters = [
	'breakfast-brunch',
	'appetizers-beverages',
	'soups-salads',
	'vegetables-sides',
	'main-dishes',
	'breads-rolls',
	'desserts',
	'cookies-candy',
	'this-and-that',
] as const;
export type Chapter = (typeof chapters)[number];

export const noChapterMessage = 'Choose a chapter.';

export const chapterSchema = z.enum(chapters, noChapterMessage);

export const chapterLabels = {
	'breakfast-brunch': 'Breakfast & Brunch',
	'appetizers-beverages': 'Appetizers & Beverages',
	'soups-salads': 'Soups & Salads',
	'vegetables-sides': 'Vegetables & Side Dishes',
	'main-dishes': 'Main Dishes',
	'breads-rolls': 'Breads & Rolls',
	desserts: 'Desserts',
	'cookies-candy': 'Cookies & Candy',
	'this-and-that': 'This & That',
} as const satisfies Record<Chapter, string>;

// What the site's JSON-LD gives as each chapter's schema.org recipeCategory: its courses, as Google
// asks, listed with commas. This & That is no course, so it gives none.
export const chapterRecipeCategories = {
	'breakfast-brunch': 'Breakfast, Brunch',
	'appetizers-beverages': 'Appetizer, Beverage',
	'soups-salads': 'Soup, Salad',
	'vegetables-sides': 'Side dish',
	'main-dishes': 'Main course',
	'breads-rolls': 'Bread',
	desserts: 'Dessert',
	'cookies-candy': 'Cookies, Candy',
	'this-and-that': undefined,
} as const satisfies Record<Chapter, string | undefined>;

// The recipeCategory values an imported page names each chapter by, compared by slug key, so case and
// punctuation don't count. A value names a chapter only as a whole: "Bread pudding" is no bread.
const chapterCategoryHints = {
	'breakfast-brunch': ['breakfast', 'brunch'],
	'appetizers-beverages': [
		'appetizer',
		'appetizers',
		'starter',
		'starters',
		'snack',
		'snacks',
		'hors d’oeuvres',
		'beverage',
		'beverages',
		'drink',
		'drinks',
		'cocktail',
		'cocktails',
	],
	'soups-salads': ['soup', 'soups', 'salad', 'salads', 'stew', 'stews'],
	'vegetables-sides': ['side', 'sides', 'side dish', 'side dishes', 'vegetable', 'vegetables'],
	'main-dishes': [
		'main',
		'mains',
		'main course',
		'main courses',
		'main dish',
		'main dishes',
		'dinner',
		'entree',
		'entrees',
	],
	'breads-rolls': ['bread', 'breads', 'quick bread', 'quick breads', 'roll', 'rolls'],
	desserts: ['dessert', 'desserts', 'cake', 'cakes', 'pie', 'pies'],
	'cookies-candy': ['cookie', 'cookies', 'candy', 'candies', 'bars', 'fudge'],
	'this-and-that': ['sauce', 'sauces', 'condiment', 'condiments', 'preserves'],
} as const satisfies Record<Chapter, readonly string[]>;

const chaptersByCategory = new Map(
	chapters.flatMap((chapter) =>
		chapterCategoryHints[chapter].map((hint) => [slugKey(hint), chapter] as const)
	)
);

// The chapter the first category naming one names, or null when none does. Each entry is one
// category, so a value listing several with commas is split first.
export function chapterFromCategories(categories: readonly string[]): Chapter | null {
	return (
		categories
			.map((category) => chaptersByCategory.get(slugKey(category)))
			.find((chapter) => chapter !== undefined) ?? null
	);
}
