import { describe, expect, it } from 'vitest';
import { recipeMetaDescription } from '@/components/recipe/recipe-meta-description';
import type { IngredientSection } from '@/domain/recipe/ingredient';

function section(...items: string[]): IngredientSection {
	return { lines: items.map((item) => ({ text: item, item })) };
}

describe('recipeMetaDescription', () => {
	it("keeps the recipe's own description", () => {
		expect(
			recipeMetaDescription({
				description: 'A mild one pot curry with coconut milk.',
				source: 'Aunt June',
				times: { totalMinutes: 35 },
				ingredientSections: [section('chicken thighs', 'coconut milk')],
			})
		).toBe('A mild one pot curry with coconut milk.');
	});

	it('describes the source, the yield, the total time, and the first few ingredients', () => {
		expect(
			recipeMetaDescription({
				source: 'Aunt June',
				yield: { kind: 'servings', amount: { min: 4 } },
				times: { prepMinutes: 15, cookMinutes: 75 },
				ingredientSections: [section('whole chicken', 'lemons', 'garlic cloves', 'olive oil')],
			})
		).toBe(
			'From Aunt June. Serves 4. Ready in 1 hr 30 min. Made with whole chicken, lemons, garlic cloves, and more.'
		);
	});

	it('leaves out the facts a recipe lacks', () => {
		expect(
			recipeMetaDescription({ times: {}, ingredientSections: [section('flour', 'water')] })
		).toBe('Made with flour and water.');
	});

	it('names each ingredient once, as first written, across sections', () => {
		expect(
			recipeMetaDescription({
				yield: { kind: 'makes', amount: { min: 12 }, unit: 'bars' },
				times: {},
				ingredientSections: [section('Butter', 'flour'), section('butter', 'sugar')],
			})
		).toBe('Makes 12 bars. Made with Butter, flour, and sugar.');
	});
});
