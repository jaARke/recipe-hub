import { describe, expect, it } from 'vitest';
import { writtenContent } from '@/domain/recipe/content-limits';
import {
	formatScaledToLine,
	formatScaledYield,
	formatScaleStepperLabel,
	formatStepsNote,
	formatYield,
	readYieldAmount,
	recipeYieldSchemaFor,
	scaleFactor,
	scaleStepperFor,
	scaleStepperValue,
	scaleYield,
	type RecipeYield,
	type ScaleStepper,
} from '@/domain/recipe/recipe-yield';

const recipeYieldSchema = recipeYieldSchemaFor(writtenContent);

describe('formatYield', () => {
	it('writes servings', () => {
		expect(formatYield({ kind: 'servings', amount: { min: 6 } })).toBe('Serves 6');
		expect(formatYield({ kind: 'servings', amount: { min: 4, max: 6 } })).toBe('Serves 4 to 6');
	});

	it('writes counts with and without a unit', () => {
		expect(formatYield({ kind: 'makes', amount: { min: 10 } })).toBe('Makes 10');
		expect(formatYield({ kind: 'makes', amount: { min: 10 }, unit: 'biscuits' })).toBe(
			'Makes 10 biscuits'
		);
	});
});

describe('scaleYield', () => {
	it.each<[RecipeYield, number, string]>([
		[{ kind: 'servings', amount: { min: 6 } }, 4 / 6, 'Serves 4'],
		[{ kind: 'makes', amount: { min: 24 }, unit: 'cookies' }, 36 / 24, 'Makes 36 cookies'],
		[{ kind: 'servings', amount: { min: 4, max: 6 } }, 2, 'Serves 8 to 12'],
		[{ kind: 'makes', amount: { min: 1 }, unit: 'loaf' }, 2, 'Makes 2 loaves'],
		[{ kind: 'makes', amount: { min: 10 } }, 1 / 2, 'Makes 5'],
	])('scales %j by %s to read "%s"', (recipeYield, factor, expected) => {
		expect(formatYield(scaleYield(recipeYield, factor))).toBe(expected);
	});

	it('leaves the yield as it is at the original scale', () => {
		const recipeYield: RecipeYield = { kind: 'makes', amount: { min: 1 }, unit: 'loaf' };
		expect(scaleYield(recipeYield, 1)).toBe(recipeYield);
	});
});

const serves6: RecipeYield = { kind: 'servings', amount: { min: 6 } };
const makes24Cookies: RecipeYield = { kind: 'makes', amount: { min: 24 }, unit: 'cookies' };
const serves4To6: RecipeYield = { kind: 'servings', amount: { min: 4, max: 6 } };

describe('scaleStepperFor', () => {
	it.each<[string, RecipeYield | undefined, ScaleStepper]>([
		['servings by one', serves6, { kind: 'servings', original: 6, step: 1, min: 1, max: 48 }],
		[
			'what it makes by half its count',
			makes24Cookies,
			{ kind: 'makes', original: 24, step: 12, min: 12, max: 192 },
		],
		[
			'one loaf by a whole loaf',
			{ kind: 'makes', amount: { min: 1 }, unit: 'loaf' },
			{ kind: 'makes', original: 1, step: 1, min: 1, max: 8 },
		],
		[
			'an odd count by the whole count, so no count shown is a half',
			{ kind: 'makes', amount: { min: 15 } },
			{ kind: 'makes', original: 15, step: 15, min: 15, max: 120 },
		],
		[
			'a range in batches',
			serves4To6,
			{ kind: 'batches', original: 1, step: 0.5, min: 0.5, max: 8 },
		],
		[
			'no yield in batches',
			undefined,
			{ kind: 'batches', original: 1, step: 0.5, min: 0.5, max: 8 },
		],
		[
			'a count that is not whole in batches',
			{ kind: 'makes', amount: { min: 1.5 }, unit: 'dozen' },
			{ kind: 'batches', original: 1, step: 0.5, min: 0.5, max: 8 },
		],
	])('steps %s', (_, recipeYield, stepper) => {
		expect(scaleStepperFor(recipeYield)).toStrictEqual(stepper);
	});

	it('steps "Makes 24 cookies" through 12, 24, and 36', () => {
		const stepper = scaleStepperFor(makes24Cookies);
		expect([-1, 0, 1].map((steps) => stepper.original + steps * stepper.step)).toEqual([
			12, 24, 36,
		]);
	});
});

describe('scaleStepperValue', () => {
	it.each<[RecipeYield | undefined, number, number]>([
		[serves6, 7, 7],
		[serves6, 7.4, 7],
		[serves6, 7.5, 8],
		[serves6, 0.2, 1],
		[serves6, 100, 48],
		[makes24Cookies, 36, 36],
		[makes24Cookies, 29, 24],
		[makes24Cookies, 30, 36],
		[makes24Cookies, 5, 12],
		[makes24Cookies, 500, 192],
		[undefined, 1.3, 1.5],
		[undefined, 0.1, 0.5],
		[undefined, 9, 8],
	])('holds %j at %s as %s, the nearest step within bounds', (recipeYield, value, held) => {
		expect(scaleStepperValue(scaleStepperFor(recipeYield), value)).toBe(held);
	});
});

describe('scaleFactor', () => {
	it.each<[RecipeYield | undefined, number, number]>([
		[serves6, 12, 2],
		[serves6, 6, 1],
		[makes24Cookies, 36, 1.5],
		[serves4To6, 1.5, 1.5],
		[undefined, 0.5, 0.5],
	])('scales %j at %s by %s', (recipeYield, value, factor) => {
		expect(scaleFactor(scaleStepperFor(recipeYield), value)).toBe(factor);
	});
});

describe('formatScaleStepperLabel', () => {
	it.each<[RecipeYield | undefined, string]>([
		[serves6, 'Servings'],
		[makes24Cookies, 'Cookies'],
		[{ kind: 'makes', amount: { min: 1 }, unit: 'loaf' }, 'Loaves'],
		[{ kind: 'makes', amount: { min: 2 }, unit: 'dozen rolls' }, 'Dozen rolls'],
		[{ kind: 'makes', amount: { min: 24 } }, 'Makes'],
		[serves4To6, 'Batches'],
		[{ kind: 'makes', amount: { min: 1.5 }, unit: 'dozen' }, 'Batches'],
		[undefined, 'Batches'],
	])('labels the stepper of %j "%s"', (recipeYield, expected) => {
		expect(formatScaleStepperLabel(recipeYield)).toBe(expected);
	});
});

describe('formatScaledYield', () => {
	it.each<[RecipeYield | undefined, number, string]>([
		[serves6, 2, 'Serves 12'],
		[makes24Cookies, 1.5, 'Makes 36 cookies'],
		[serves4To6, 1.5, 'Serves 6 to 9'],
		[undefined, 1.5, '1½ batches'],
		[undefined, 1, '1 batch'],
		[undefined, 0.5, '½ batch'],
	])('gives %j by %s as "%s"', (recipeYield, factor, expected) => {
		expect(formatScaledYield(recipeYield, factor)).toBe(expected);
	});
});

describe('formatScaledToLine', () => {
	it.each<[RecipeYield | undefined, number, string]>([
		[serves6, 8 / 6, 'Scaled to 8 servings (recipe serves 6)'],
		[serves6, 1 / 6, 'Scaled to 1 serving (recipe serves 6)'],
		[makes24Cookies, 1.5, 'Scaled to 36 cookies (recipe makes 24 cookies)'],
		[
			{ kind: 'makes', amount: { min: 1 }, unit: 'loaf' },
			2,
			'Scaled to 2 loaves (recipe makes 1 loaf)',
		],
		[serves4To6, 1.5, 'Scaled to 6 to 9 servings (recipe serves 4 to 6)'],
		[{ kind: 'makes', amount: { min: 24 } }, 1.5, 'Scaled to 1½ batches (recipe makes 24)'],
		[undefined, 1.5, 'Scaled to 1½ batches'],
	])('prints %j by %s as "%s"', (recipeYield, factor, expected) => {
		expect(formatScaledToLine(recipeYield, factor)).toBe(expected);
	});
});

describe('formatStepsNote', () => {
	it.each<[RecipeYield | undefined, string]>([
		[serves6, 'Amounts in the steps are for the original 6 servings.'],
		[
			{ kind: 'servings', amount: { min: 1 } },
			'Amounts in the steps are for the original 1 serving.',
		],
		[serves4To6, 'Amounts in the steps are for the original 4 to 6 servings.'],
		[makes24Cookies, 'Amounts in the steps are for the original 24 cookies.'],
		[{ kind: 'makes', amount: { min: 24 } }, 'Amounts in the steps are for the original batch.'],
		[undefined, 'Amounts in the steps are for the original batch.'],
	])('notes the steps of %j as "%s"', (recipeYield, expected) => {
		expect(formatStepsNote(recipeYield)).toBe(expected);
	});
});

describe('recipeYieldSchema', () => {
	it('rejects an unknown kind', () => {
		expect(recipeYieldSchema.safeParse({ kind: 'feeds', amount: { min: 4 } }).success).toBe(false);
	});

	it.each([
		['cookies.', 'cookies'],
		['dozen cookies ;', 'dozen cookies'],
		['2 in cookies:', '2 in cookies'],
		['doz.', 'doz.'],
		['loaves [?].', 'loaves [?]'],
	])('stores what a recipe makes, %j, without the punctuation that ends it', (unit, stored) => {
		expect(recipeYieldSchema.parse({ kind: 'makes', amount: { min: 12 }, unit })).toEqual({
			kind: 'makes',
			amount: { min: 12 },
			unit: stored,
		});
	});
});

describe('readYieldAmount', () => {
	it.each([
		['4', { min: 4 }],
		['4.', { min: 4 }],
		[' 4 to 6; ', { min: 4, max: 6 }],
		['1½,', { min: 1.5 }],
		['12:', { min: 12 }],
	])('reads %j without the punctuation that ends it', (text, amount) => {
		expect(readYieldAmount(text)).toStrictEqual(amount);
	});

	it.each([
		['four', { min: 4 }],
		['Four.', { min: 4 }],
		['four to six', { min: 4, max: 6 }],
		['two and a half', { min: 2.5 }],
	])('reads the amount in words in %j', (text, amount) => {
		expect(readYieldAmount(text)).toStrictEqual(amount);
	});

	it.each(['4 [?]', '4?', 'a few.', '.', 'half', 'a'])('reads no amount in %j', (text) => {
		expect(readYieldAmount(text)).toBeUndefined();
	});
});
