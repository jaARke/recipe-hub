import { describe, expect, it } from 'vitest';
import {
	cookingChecksEntry,
	cookingChecksKey,
	countCheckedLines,
	ingredientCheckKey,
	readCookingChecks,
	type CookingCheckKey,
	type CookingChecksRecipe,
} from '@/components/cooking/cooking-checks';
import type { IngredientSection } from '@/domain/recipe/ingredient';
import { recipeIdSchema } from '@/domain/recipe/recipe';

const roast: CookingChecksRecipe = {
	id: recipeIdSchema.parse('0199c7a4-2c3e-7b1a-9f00-2a7c1e4b5d6e'),
	version: '2026-10-05T08:30:00.000Z',
};

const sections: IngredientSection[] = [
	{
		lines: [
			{ text: '2 cups flour', amount: { min: 2 }, unit: 'cups', item: 'flour' },
			{ text: 'Salt to taste', item: 'Salt', preparation: 'to taste' },
		],
	},
	{
		heading: 'For the glaze',
		lines: [{ text: '1 cup sugar', amount: { min: 1 }, unit: 'cup', item: 'sugar' }],
	},
];

describe('cooking checks', () => {
	it('keys each version of a recipe apart, so an edit starts the checks over', () => {
		expect(cookingChecksKey(roast)).toBe(
			'cooking:0199c7a4-2c3e-7b1a-9f00-2a7c1e4b5d6e:2026-10-05T08:30:00.000Z'
		);
		expect(cookingChecksKey({ ...roast, version: '2026-10-06T09:00:00.000Z' })).not.toBe(
			cookingChecksKey(roast)
		);
	});

	it('reads back the lines it kept, by section and line', () => {
		const checked = new Set<CookingCheckKey>([ingredientCheckKey(0, 1), ingredientCheckKey(1, 0)]);

		expect(cookingChecksEntry(checked)).toBe('["0:1","1:0"]');
		expect(readCookingChecks(cookingChecksEntry(checked))).toEqual(checked);
	});

	it('keeps nothing when nothing is checked', () => {
		expect(cookingChecksEntry(new Set())).toBeUndefined();
	});

	it.each([undefined, 'not json', '{"0:1":true}', '["0:1","step:0:0"]', '["-1:0"]', '[1]'])(
		'reads no checks from %j',
		(entry) => {
			expect(readCookingChecks(entry).size).toBe(0);
		}
	);

	it('counts only the recipe’s own lines as gathered', () => {
		const checked = new Set<CookingCheckKey>(['0:0', '1:0', '7:2']);

		expect(countCheckedLines(sections, checked)).toEqual({ checked: 2, total: 3 });
	});
});
