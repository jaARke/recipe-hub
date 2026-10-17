import { describe, expect, it } from 'vitest';
import {
	cookingNextLabel,
	cookingResumedText,
	cookingScreens,
	cookingStepHeading,
	cookingViewParams,
	parseCookingStepParam,
	startsCookingGroup,
	withCookingStepParam,
	type CookingScreen,
} from '@/components/cooking/cooking-screens';
import type { InstructionSection } from '@/domain/recipe/instruction';
import type { RecipeYield } from '@/domain/recipe/recipe-yield';
import type { RouteSearchParams } from '@/lib/url-query';

// Two sections, the first without a heading, as a pot roast and its gravy.
const sectioned: InstructionSection[] = [
	{ steps: [{ text: 'Sear the roast.' }, { text: 'Braise it for 3 hours.' }] },
	{ heading: 'For the gravy', steps: [{ text: 'Whisk in the flour.' }] },
];

const oneStep: InstructionSection[] = [{ steps: [{ text: 'Toss everything together.' }] }];

describe('cookingScreens', () => {
	it('opens on Gather, numbers the steps across sections, and ends on the finish', () => {
		expect(cookingScreens(sectioned)).toEqual([
			{ kind: 'gather' },
			{
				kind: 'step',
				number: 1,
				sectionIndex: 0,
				sectionHeading: undefined,
				text: 'Sear the roast.',
			},
			{
				kind: 'step',
				number: 2,
				sectionIndex: 0,
				sectionHeading: undefined,
				text: 'Braise it for 3 hours.',
			},
			{
				kind: 'step',
				number: 3,
				sectionIndex: 1,
				sectionHeading: 'For the gravy',
				text: 'Whisk in the flour.',
			},
			{ kind: 'finish' },
		]);
	});

	it('gives a one-step recipe three screens', () => {
		expect(cookingScreens(oneStep).map((screen) => screen.kind)).toEqual([
			'gather',
			'step',
			'finish',
		]);
	});
});

describe('startsCookingGroup', () => {
	it('sets apart Gather, the first step, and the first step of each later section', () => {
		const screens = cookingScreens(sectioned);
		expect(screens.map((_, index) => startsCookingGroup(screens, index))).toEqual([
			false,
			true,
			false,
			true,
			true,
		]);
	});
});

describe('cookingStepHeading', () => {
	it('reads a step with its section first, as the screen shows it', () => {
		const [, first, , gravy] = cookingScreens(sectioned);

		expect(first?.kind === 'step' && cookingStepHeading(first, 3)).toBe('Step 1 of 3');
		expect(gravy?.kind === 'step' && cookingStepHeading(gravy, 3)).toBe(
			'For the gravy, step 3 of 3'
		);
	});
});

describe('cookingNextLabel', () => {
	it('names Next for its move, with none on the finish', () => {
		const screens = cookingScreens(sectioned);
		expect(screens.map((_, index) => cookingNextLabel(screens, index))).toEqual([
			'Start cooking',
			'Next step',
			'Next step',
			'Finish',
			undefined,
		]);
	});
});

describe('cookingResumedText', () => {
	it.each<[CookingScreen | undefined, string | undefined]>([
		[
			{ kind: 'step', number: 4, sectionIndex: 0, text: 'Stir.' },
			'Picked up at step 4, where you left off.',
		],
		[{ kind: 'finish' }, 'Picked up at the end, where you left off.'],
		[{ kind: 'gather' }, undefined],
		[undefined, undefined],
	])('says, for %j, %j', (screen, text) => {
		expect(cookingResumedText(screen)).toBe(text);
	});
});

describe('parseCookingStepParam', () => {
	// Gather, three steps, and the finish.
	const screenCount = 5;

	it.each([
		['step=1', 1],
		['step=3', 3],
		['step=4', 4],
		['step=2&servings=12', 2],
	])('reads %j as screen %s', (query, index) => {
		expect(parseCookingStepParam(new URLSearchParams(query), screenCount)).toBe(index);
	});

	it.each(['', 'step=0', 'step=5', 'step=04', 'step=2.5', 'step=-1', 'step=two', 'step=1&step=2'])(
		'opens Gather for %j',
		(query) => {
			expect(parseCookingStepParam(new URLSearchParams(query), screenCount)).toBe(0);
		}
	);
});

describe('withCookingStepParam', () => {
	it.each([
		['', 4, 'step=4'],
		['servings=12', 2, 'servings=12&step=2'],
		['step=3&servings=12', 0, 'servings=12'],
		['step=3', 1, 'step=1'],
	])('writes %j at screen %s as %j', (query, index, written) => {
		expect(withCookingStepParam(new URLSearchParams(query), index).toString()).toBe(written);
	});

	it('round-trips through the parser', () => {
		const params = withCookingStepParam(new URLSearchParams(), 3);
		expect(parseCookingStepParam(params, 5)).toBe(3);
	});
});

describe('cookingViewParams', () => {
	const serves6: RecipeYield = { kind: 'servings', amount: { min: 6 } };
	const makes24: RecipeYield = { kind: 'makes', amount: { min: 24 }, unit: 'cookies' };

	it.each<[string, RouteSearchParams, RecipeYield | undefined, string]>([
		['the step and the servings', { step: '4', servings: '12' }, serves6, 'step=4&servings=12'],
		['the step and the count it makes', { makes: '36', step: '2' }, makes24, 'step=2&makes=36'],
		['the batches of a recipe with no yield', { batches: '1.5' }, undefined, 'batches=1.5'],
		[
			'none of the rest, nor another kind of scale',
			{ step: '3', ref: 'share', makes: '36', servings: '12' },
			serves6,
			'step=3&servings=12',
		],
		['a repeated value as given', { step: ['2', '3'] }, serves6, 'step=2&step=3'],
		['nothing, from nothing', {}, serves6, ''],
	])('keeps %s', (_kept, searchParams, recipeYield, kept) => {
		expect(cookingViewParams(searchParams, recipeYield).toString()).toBe(kept);
	});
});
