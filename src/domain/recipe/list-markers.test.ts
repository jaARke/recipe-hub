import { describe, expect, it } from 'vitest';
import { withoutListMarkers } from '@/domain/recipe/list-markers';

describe('withoutListMarkers', () => {
	it.each([
		['• 2 cups flour', '2 cups flour'],
		['- 1 teaspoon salt', '1 teaspoon salt'],
		['* 3 eggs', '3 eggs'],
		['+ 1 egg', '1 egg'],
		['▢ 1 cup milk', '1 cup milk'],
		['☐ 1 lemon', '1 lemon'],
		['–2 limes', '2 limes'],
		['— 1 orange', '1 orange'],
		['  •  2 eggs', '2 eggs'],
	])('drops the bullet or checkbox in %j', (line, words) => {
		expect(withoutListMarkers(line)).toBe(words);
	});

	it.each([
		['1. Heat the oven.', 'Heat the oven.'],
		['2) Mix the flour.', 'Mix the flour.'],
		['3: Bake.', 'Bake.'],
		['Step 3: Bake.', 'Bake.'],
		['STEP 4 - Cool.', 'Cool.'],
		['Step5. Serve.', 'Serve.'],
		['1. 2 eggs', '2 eggs'],
		['Step 5', ''],
		['7.', ''],
	])('drops the step number in %j', (line, words) => {
		expect(withoutListMarkers(line)).toBe(words);
	});

	it('drops markers that follow each other', () => {
		expect(withoutListMarkers('1. • ▢ 2 eggs')).toBe('2 eggs');
	});

	it.each([
		'1.5 cups milk',
		'2 eggs',
		'1-1/2 cups milk',
		'-2 degrees outside',
		'2:30 in the afternoon',
		'Steps to follow',
		'[illegible] cups flour',
		'Stir 2. Then rest.',
	])('keeps %j, which a marker does not start', (line) => {
		expect(withoutListMarkers(line)).toBe(line);
	});
});
