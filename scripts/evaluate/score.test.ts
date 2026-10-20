import { describe, expect, it } from 'vitest';
import type { ExtractedRecipe } from '@/domain/recipe/extracted-recipe';
import { fieldWeights, scoredFields, scoreRecipe } from './score';

// A synthetic card with a sectioned list, as an expected.json holds one.
const expected: ExtractedRecipe = {
	title: 'Lemon bars',
	source: 'Great-aunt Edie',
	yield: { kind: 'makes', amount: '16', unit: 'bars' },
	times: {},
	ingredientSections: [
		{ lines: ['1 cup flour', '½ cup butter', '1¼ cups sugar', '2 eggs'] },
		{ heading: 'Glaze', lines: ['1 cup powdered sugar', '2 tablespoons lemon juice'] },
	],
	instructionSections: [
		{ steps: ['Press the crust into the pan.', "Bake 20 min. Don't let it brown."] },
	],
	holidays: [],
	diets: [],
	reviewNotes: [],
};

function reading(changes: Partial<ExtractedRecipe>): ExtractedRecipe {
	return { ...expected, ...changes };
}

describe('scoreRecipe', () => {
	it('scores an exact reading 1 with nothing missed and no signals', () => {
		const result = scoreRecipe(expected, expected);

		expect(result.score).toBeCloseTo(1);
		expect(result.missedLines).toEqual([]);
		expect(result.signals).toEqual({
			unmatchedLines: [],
			inventedFields: [],
			numberMismatches: [],
		});
	});

	it('scores no recipe 0 and misses every line', () => {
		const result = scoreRecipe(expected, null);

		expect(result.score).toBe(0);
		expect(result.missedLines).toHaveLength(6);
	});

	it('reads quotes, dashes, spacing, fractions, and doubt markers as the text they stand for', () => {
		const result = scoreRecipe(
			expected,
			reading({
				title: 'Lemon Bars',
				source: 'Great\u2013aunt  Edie',
				ingredientSections: [
					{ lines: ['1 cup flour', '1/2 cup butter', '1 ¼ cups sugar', '2 eggs [?]'] },
					{ heading: 'Glaze', lines: ['1 cup powdered sugar', '2 tablespoons lemon juice'] },
				],
				instructionSections: [
					{ steps: ['Press the crust into the pan.', 'Bake 20 min. Don\u2019t let it brown.'] },
				],
			})
		);

		expect(result.score).toBeCloseTo(1);
	});

	it('keeps case in ingredient lines and steps', () => {
		const result = scoreRecipe(
			expected,
			reading({
				instructionSections: [
					{ steps: ['press the crust into the pan.', "Bake 20 min. Don't let it brown."] },
				],
			})
		);

		expect(result.fields.steps).toBeCloseTo(1 - 1 / 62);
	});

	it('scores ingredient lines as a soft F1 over every section', () => {
		const result = scoreRecipe(
			expected,
			reading({
				ingredientSections: [
					{ lines: ['1 cup flour', '½ cup butter', '1¼ cups sugar', '1 lemon'] },
					{ heading: 'Glaze', lines: ['1 cup powdered sugar', '2 tablespoons lemon juice'] },
				],
			})
		);

		expect(result.fields.ingredients).toBeCloseTo((2 * 5) / 12);
		expect(result.missedLines).toEqual(['2 eggs']);
		expect(result.signals.unmatchedLines).toEqual(['1 lemon']);
	});

	it('flags a matched line whose numbers differ', () => {
		const result = scoreRecipe(
			expected,
			reading({
				ingredientSections: [
					{ lines: ['1 cup flour', '½ cup butter', '1¼ cups sugar', '3 eggs'] },
					{ heading: 'Glaze', lines: ['1 cup powdered sugar', '2 tablespoons lemon juice'] },
				],
			})
		);

		expect(result.fields.ingredients).toBeCloseTo((2 * (5 + 5 / 6)) / 12);
		expect(result.signals.numberMismatches).toEqual([{ expected: '2 eggs', produced: '3 eggs' }]);
	});

	it('scores steps on their joined text, so splitting them differently costs nothing', () => {
		const merged = scoreRecipe(
			expected,
			reading({
				instructionSections: [
					{ steps: ["Press the crust into the pan. Bake 20 min. Don't let it brown."] },
				],
			})
		);
		const dropped = scoreRecipe(
			expected,
			reading({ instructionSections: [{ steps: ['Press the crust into the pan.'] }] })
		);

		expect(merged.fields.steps).toBe(1);
		expect(dropped.fields.steps).toBeCloseTo(1 - 33 / 62);
	});

	it('scores a recipe without steps against one that has none', () => {
		const card = reading({ instructionSections: [] });

		expect(scoreRecipe(card, card).fields.steps).toBe(1);
		expect(scoreRecipe(card, expected).fields.steps).toBe(0);
	});

	it('reports fields the expected recipe leaves out, but not blank ones', () => {
		const result = scoreRecipe(
			expected,
			reading({ notes: 'A family favorite.', description: ' ', times: { cookMinutes: 20 } })
		);

		expect(result.signals.inventedFields).toEqual([
			{ field: 'notes', value: 'A family favorite.' },
			{ field: 'cookMinutes', value: '20 minutes' },
		]);
		expect(result.fields.notes).toBe(0);
		expect(result.fields.description).toBe(1);
		expect(result.fields.times).toBeCloseTo(2 / 3);
	});

	it('matches yield amounts by value, and units only for what a recipe makes', () => {
		const servings = reading({ yield: { kind: 'servings', amount: '4 to 6' } });

		expect(
			scoreRecipe(servings, reading({ yield: { kind: 'servings', amount: '4-6', unit: 'people' } }))
				.fields.yield
		).toBe(1);
		expect(
			scoreRecipe(expected, reading({ yield: { kind: 'makes', amount: '16', unit: 'squares' } }))
				.fields.yield
		).toBe(0);
		expect(scoreRecipe(expected, reading({ yield: undefined })).fields.yield).toBe(0);
	});

	it('scores headings by how many match, missing and extra alike', () => {
		const missing = scoreRecipe(
			expected,
			reading({
				ingredientSections: [
					{ lines: ['1 cup flour', '½ cup butter', '1¼ cups sugar', '2 eggs'] },
					{ lines: ['1 cup powdered sugar', '2 tablespoons lemon juice'] },
				],
			})
		);
		const extra = scoreRecipe(
			expected,
			reading({
				ingredientSections: [
					{ heading: 'Bars', lines: ['1 cup flour', '½ cup butter', '1¼ cups sugar', '2 eggs'] },
					{ heading: 'Glaze', lines: ['1 cup powdered sugar', '2 tablespoons lemon juice'] },
				],
			})
		);

		expect(missing.fields.headings).toBe(0);
		expect(extra.fields.headings).toBeCloseTo(2 / 3);
	});

	it('weighs every field so the case score runs from 0 to 1', () => {
		const total = scoredFields.reduce((sum, field) => sum + fieldWeights[field], 0);

		expect(total).toBeCloseTo(1);
	});
});
