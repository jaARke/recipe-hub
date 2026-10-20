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
	chapter: 'breakfast-brunch',
	holidays: [],
	diets: [],
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
	it.each([
		'',
		'not json',
		'[]',
		JSON.stringify({ ...minimalPayload, tags: 'Soup' }),
		JSON.stringify({ ...minimalPayload, chapter: 'Soups & Salads' }),
		JSON.stringify({ ...minimalPayload, diets: ['keto'] }),
	])('refuses a payload the form never sends: %s', (json) => {
		expect(problemsFrom(() => recipeContentFromForm(json))).toEqual(unreadablePayload);
	});

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

	it('reads the chapter, holidays, and diets, which the recipe completes with what they imply', () => {
		const content = contentFrom({
			chapter: 'desserts',
			holidays: ['easter', 'christmas'],
			diets: ['vegan'],
		});

		expect(content).toMatchObject({
			chapter: 'desserts',
			holidays: ['easter', 'christmas'],
			diets: ['vegan'],
		});
		expect(parseRecipeContent(content).diets).toEqual(['vegetarian', 'vegan', 'dairy-free']);
	});

	it('refuses a recipe with no chapter, with its other problems', () => {
		expect(problemsFrom(() => contentFrom({ title: '', chapter: undefined }))).toEqual([
			{ path: 'title', message: 'Enter a title.' },
			{ path: 'chapter', message: 'Choose a chapter.' },
		]);
		expect(
			problemsFrom(() =>
				contentFrom({ chapter: undefined, yield: { kind: 'servings', amount: 'a few' } })
			)
		).toEqual([
			{
				path: 'yield.amount',
				message: 'We couldn’t read this amount. Use a number, or two numbers for a range.',
			},
			{ path: 'chapter', message: 'Choose a chapter.' },
		]);
	});

	it('keeps each image’s role, order, and size, and omits blank alt text', () => {
		const landscape = { width: 2400, height: 1800 };
		const portrait = { width: 2304, height: 3072 };
		expect(
			contentFrom({
				images: [
					{
						role: 'dish',
						pathname: 'dish/development/a.jpg',
						size: landscape,
						alt: 'A slice of pie',
					},
					{ role: 'dish', pathname: 'dish/development/b.jpg', size: landscape, alt: ' ' },
					{ role: 'scan', pathname: 'scan/development/c.jpg', size: portrait },
				],
			}).images
		).toEqual([
			{
				role: 'dish',
				pathname: 'dish/development/a.jpg',
				size: landscape,
				alt: 'A slice of pie',
			},
			{ role: 'dish', pathname: 'dish/development/b.jpg', size: landscape },
			{ role: 'scan', pathname: 'scan/development/c.jpg', size: portrait },
		]);
	});

	it('refuses a size the form never sends', () => {
		const json = JSON.stringify({
			...minimalPayload,
			images: [{ role: 'dish', pathname: 'dish/development/a.jpg', size: { width: '2400' } }],
		});

		expect(problemsFrom(() => recipeContentFromForm(json))).toEqual(unreadablePayload);
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
