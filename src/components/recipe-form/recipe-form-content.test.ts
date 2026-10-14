import { describe, expect, it } from 'vitest';
import { recipeContentFromForm } from '@/components/recipe-form/recipe-form-content';
import type { RecipeFormPayload } from '@/components/recipe-form/recipe-form-fields';
import {
	recipeFormSubmission,
	recipeFormValues,
} from '@/components/recipe-form/recipe-form-values';
import type { Problem } from '@/domain/problem';
import { InvalidRecipeError } from '@/domain/recipe/errors';
import { parseRecipeContent } from '@/domain/recipe/recipe';
import { sampleRecipeContents } from '@/domain/recipe/samples/sample-recipes';

const minimalPayload: RecipeFormPayload = {
	title: 'Toast',
	times: {},
	ingredientSections: [{ lines: ['1 slice bread'] }],
	instructionSections: [{ steps: ['Toast the bread.'] }],
	tags: [],
	images: [],
};

function contentFrom(payload: Partial<RecipeFormPayload>) {
	return recipeContentFromForm(JSON.stringify({ ...minimalPayload, ...payload }));
}

function problemsFrom(read: () => unknown): readonly Problem[] {
	try {
		read();
	} catch (error) {
		if (error instanceof InvalidRecipeError) {
			return error.problems;
		}
		throw error;
	}
	throw new Error('Expected the form to be refused');
}

const unreadablePayload = [
	{ path: '', message: 'We couldn’t read the recipe. Reload the page and try again.' },
];

describe('recipeContentFromForm', () => {
	it.each(['', 'not json', '[]', JSON.stringify({ ...minimalPayload, tags: 'Soup' })])(
		'refuses a payload the form never sends: %s',
		(json) => {
			expect(problemsFrom(() => recipeContentFromForm(json))).toEqual(unreadablePayload);
		}
	);

	it('reads each ingredient line and wraps each step', () => {
		expect(
			contentFrom({
				ingredientSections: [
					{ heading: 'For the glaze', lines: ['1 cup powdered sugar, sifted', 'Pinch of salt'] },
				],
				instructionSections: [{ heading: ' ', steps: ['Whisk until smooth.'] }],
			})
		).toMatchObject({
			ingredientSections: [
				{
					heading: 'For the glaze',
					lines: [
						{
							text: '1 cup powdered sugar, sifted',
							amount: { min: 1 },
							unit: 'cup',
							item: 'powdered sugar',
							preparation: 'sifted',
						},
						{ text: 'Pinch of salt', item: 'Pinch of salt' },
					],
				},
			],
			instructionSections: [{ heading: undefined, steps: [{ text: 'Whisk until smooth.' }] }],
		});
	});

	it('omits blank optional text', () => {
		const content = contentFrom({ description: '  ', source: '', notes: 'Best warm.' });

		expect(content.description).toBeUndefined();
		expect(content.source).toBeUndefined();
		expect(content.notes).toBe('Best warm.');
	});

	it('reads minutes, and leaves anything else for the domain to refuse', () => {
		const content = contentFrom({
			times: { prepMinutes: ' 15 ', cookMinutes: 'about an hour', totalMinutes: '' },
		});

		expect(content.times).toEqual({ prepMinutes: 15, cookMinutes: Number.NaN });
		expect(problemsFrom(() => parseRecipeContent(content))).toEqual([
			{ path: 'times.cookMinutes', message: 'Enter whole minutes.' },
		]);
	});

	it('reads a serving count and what a recipe makes', () => {
		expect(
			contentFrom({ yield: { kind: 'servings', amount: '4 to 6', unit: 'people' } }).yield
		).toEqual({
			kind: 'servings',
			amount: { min: 4, max: 6 },
		});
		expect(contentFrom({ yield: { kind: 'makes', amount: '1½', unit: 'loaves' } }).yield).toEqual({
			kind: 'makes',
			amount: { min: 1.5 },
			unit: 'loaves',
		});
		expect(contentFrom({ yield: { kind: 'makes', amount: '12', unit: ' ' } }).yield).toEqual({
			kind: 'makes',
			amount: { min: 12 },
		});
		expect(contentFrom({ yield: { kind: 'servings', amount: ' ' } }).yield).toBeUndefined();
	});

	it('stores typed text in its clean form', () => {
		const content = parseRecipeContent(
			contentFrom({
				title: 'Toast  for two:',
				source: 'Grandma\u00a0 Rose',
				yield: { kind: 'servings', amount: '4.' },
				ingredientSections: [
					{
						heading: 'For the toast;',
						lines: ['2 cups flour;', '• 2 eggs', '1. 2 eggs', 'Salt to taste;', '1/4 tsp.'],
					},
				],
				instructionSections: [{ steps: ['Toast  the bread. '] }],
			})
		);

		expect(content).toMatchObject({
			title: 'Toast for two',
			source: 'Grandma Rose',
			yield: { kind: 'servings', amount: { min: 4 } },
			ingredientSections: [
				{
					heading: 'For the toast',
					lines: [
						{ text: '2 cups flour', amount: { min: 2 }, unit: 'cups', item: 'flour' },
						{ text: '2 eggs', amount: { min: 2 }, item: 'eggs' },
						{ text: '2 eggs', amount: { min: 2 }, item: 'eggs' },
						{ text: 'Salt to taste', item: 'Salt', preparation: 'to taste' },
						{ text: '1/4 tsp.', item: '1/4 tsp.' },
					],
				},
			],
			instructionSections: [{ steps: [{ text: 'Toast the bread.' }] }],
		});
		expect(
			parseRecipeContent(contentFrom({ yield: { kind: 'makes', amount: '12;', unit: 'slices.' } }))
				.yield
		).toEqual({ kind: 'makes', amount: { min: 12 }, unit: 'slices' });
	});

	it('refuses a yield it can’t read, with the recipe’s other problems', () => {
		expect(
			problemsFrom(() => contentFrom({ title: '', yield: { kind: 'servings', amount: 'a few' } }))
		).toEqual([
			{
				path: 'yield.amount',
				message: 'We couldn’t read this amount. Use a number, or two numbers for a range.',
			},
			{ path: 'title', message: 'Enter a title.' },
		]);
	});

	it('keeps each image’s role and order, and omits blank alt text', () => {
		expect(
			contentFrom({
				images: [
					{ role: 'dish', pathname: 'dish/development/a.jpg', alt: 'A slice of pie' },
					{ role: 'dish', pathname: 'dish/development/b.jpg', alt: ' ' },
					{ role: 'scan', pathname: 'scan/development/c.jpg' },
				],
			}).images
		).toEqual([
			{ role: 'dish', pathname: 'dish/development/a.jpg', alt: 'A slice of pie' },
			{ role: 'dish', pathname: 'dish/development/b.jpg' },
			{ role: 'scan', pathname: 'scan/development/c.jpg' },
		]);
	});

	it.each(sampleRecipeContents.map((content) => [content.title, content]))(
		'saves the sample "%s" unchanged through the form',
		(_title, sample) => {
			const content = parseRecipeContent(sample);
			const { payload } = recipeFormSubmission(recipeFormValues(content));

			expect(parseRecipeContent(recipeContentFromForm(JSON.stringify(payload)))).toEqual(content);
		}
	);
});
