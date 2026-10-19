import { describe, expect, it } from 'vitest';
import {
	chapterFromCategories,
	chapterLabels,
	chapterRecipeCategories,
	chapters,
	type Chapter,
} from '@/domain/recipe/chapter';

describe('chapters', () => {
	it('runs in the cookbook’s order', () => {
		expect(chapters.map((chapter) => chapterLabels[chapter])).toEqual([
			'Breakfast & Brunch',
			'Appetizers & Beverages',
			'Soups & Salads',
			'Vegetables & Side Dishes',
			'Main Dishes',
			'Breads & Rolls',
			'Desserts',
			'Cookies & Candy',
			'This & That',
		]);
	});
});

describe('chapterRecipeCategories', () => {
	it('gives This & That no recipeCategory', () => {
		expect(chapterRecipeCategories['this-and-that']).toBeUndefined();
	});

	it.each(chapters.filter((chapter) => chapter !== 'this-and-that'))(
		'gives %s categories that each import back into it',
		(chapter) => {
			const categories = chapterRecipeCategories[chapter].split(', ');
			expect(categories.map((category) => chapterFromCategories([category]))).toEqual(
				categories.map(() => chapter)
			);
		}
	);
});

describe('chapterFromCategories', () => {
	it.each<[string, Chapter]>([
		['Breakfast', 'breakfast-brunch'],
		['Brunch', 'breakfast-brunch'],
		['Appetizer', 'appetizers-beverages'],
		['Beverage', 'appetizers-beverages'],
		['Drinks', 'appetizers-beverages'],
		['Soup', 'soups-salads'],
		['Salad', 'soups-salads'],
		['Side dish', 'vegetables-sides'],
		['Main course', 'main-dishes'],
		['Dinner', 'main-dishes'],
		['Entree', 'main-dishes'],
		['Bread', 'breads-rolls'],
		['Dessert', 'desserts'],
		['Cookies', 'cookies-candy'],
		['Candy', 'cookies-candy'],
		['Sauces', 'this-and-that'],
	])('files %j in %s', (category, chapter) => {
		expect(chapterFromCategories([category])).toBe(chapter);
	});

	it.each(['MAIN COURSE', 'main-course', 'Main_Course', ' Main  course. ', 'Entrée'])(
		'ignores case, punctuation, and accents in %j',
		(category) => {
			expect(chapterFromCategories([category])).toBe('main-dishes');
		}
	);

	it('reads either apostrophe', () => {
		expect(chapterFromCategories(["Hors d'oeuvres"])).toBe('appetizers-beverages');
		expect(chapterFromCategories(['Hors d’oeuvres'])).toBe('appetizers-beverages');
	});

	it('takes the first category that names a chapter, in the page’s order', () => {
		expect(chapterFromCategories(['Holiday', 'Side Dish', 'Dessert'])).toBe('vegetables-sides');
	});

	it('names a chapter only from a whole category', () => {
		expect(chapterFromCategories(['Bread pudding', 'Christmas cookies'])).toBe(null);
	});

	it('reads each entry as one category, so a list written with commas is split before', () => {
		expect(chapterFromCategories(['Dessert, Snack'])).toBe(null);
	});

	it('names none when no category names one', () => {
		expect(chapterFromCategories(['Holiday', 'Easy', ''])).toBe(null);
		expect(chapterFromCategories([])).toBe(null);
	});
});
