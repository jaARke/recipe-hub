import { describe, expect, it } from 'vitest';
import {
	parseRecipeScaleParam,
	withRecipeScaleParam,
} from '@/components/recipe/recipe-scale-params';
import { scaleStepperFor } from '@/domain/recipe/recipe-yield';

// Serves 6, makes 24 cookies, and no yield.
const servings = scaleStepperFor({ kind: 'servings', amount: { min: 6 } });
const makes = scaleStepperFor({ kind: 'makes', amount: { min: 24 }, unit: 'cookies' });
const batches = scaleStepperFor(undefined);

describe('parseRecipeScaleParam', () => {
	it.each([
		['servings=8', 8, servings],
		['servings=12&ref=share', 12, servings],
		['makes=36', 36, makes],
		['batches=1.5', 1.5, batches],
		['batches=0.5', 0.5, batches],
	])('reads %j as %s', (query, value, stepper) => {
		expect(parseRecipeScaleParam(new URLSearchParams(query), stepper)).toBe(value);
	});

	it.each([
		['', 6, servings],
		['servings=abc', 6, servings],
		['servings=0', 6, servings],
		['servings=-2', 6, servings],
		['servings=', 6, servings],
		['servings=1e1', 6, servings],
		['servings=8&servings=10', 6, servings],
		['makes=12', 6, servings],
		['servings=8', 24, makes],
		['batches=.5', 1, batches],
		['batches=Infinity', 1, batches],
	])('leaves the recipe at its own scale for %j, %s', (query, value, stepper) => {
		expect(parseRecipeScaleParam(new URLSearchParams(query), stepper)).toBe(value);
	});

	it.each([
		['servings=7.4', 7, servings],
		['servings=0.2', 1, servings],
		['servings=100', 48, servings],
		['makes=30', 36, makes],
		['makes=5', 12, makes],
		['makes=1000', 192, makes],
		['batches=1.3', 1.5, batches],
		['batches=9', 8, batches],
	])('holds %j to %s, the nearest step within bounds', (query, value, stepper) => {
		expect(parseRecipeScaleParam(new URLSearchParams(query), stepper)).toBe(value);
	});

	it('reads the batches of a range yield and ignores its servings', () => {
		const range = scaleStepperFor({ kind: 'servings', amount: { min: 4, max: 6 } });
		expect(parseRecipeScaleParam(new URLSearchParams('batches=2'), range)).toBe(2);
		expect(parseRecipeScaleParam(new URLSearchParams('servings=8'), range)).toBe(1);
	});
});

describe('withRecipeScaleParam', () => {
	it.each([
		['', 8, 'servings=8', servings],
		['ref=share', 12, 'ref=share&servings=12', servings],
		['servings=8', 6, '', servings],
		['ref=share&servings=8', 6, 'ref=share', servings],
		['', 100, 'servings=48', servings],
		['', 36, 'makes=36', makes],
		['', 1.5, 'batches=1.5', batches],
		['', 1, '', batches],
	])('writes %j at %s as %j', (query, value, written, stepper) => {
		expect(withRecipeScaleParam(new URLSearchParams(query), stepper, value).toString()).toBe(
			written
		);
	});

	it('round-trips through the parser', () => {
		const params = withRecipeScaleParam(new URLSearchParams(), makes, 12);
		expect(parseRecipeScaleParam(params, makes)).toBe(12);
	});
});
