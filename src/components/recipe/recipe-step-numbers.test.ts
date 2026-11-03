import { describe, expect, it } from 'vitest';
import { numberInstructionSteps } from '@/components/recipe/recipe-step-numbers';
import type { InstructionSection } from '@/domain/recipe/instruction';

// Each step's number and the last number in its count, section by section.
function numbers(sections: readonly InstructionSection[]): [number, number][][] {
	return numberInstructionSteps(sections).map((section) =>
		section.steps.map((step): [number, number] => [step.number, step.lastNumber])
	);
}

describe('numberInstructionSteps', () => {
	it('counts from 1 again after each heading', () => {
		expect(
			numbers([
				{ steps: [{ text: 'Sear the roast.' }, { text: 'Braise it for 3 hours.' }] },
				{
					heading: 'For the gravy',
					steps: [{ text: 'Whisk in the flour.' }, { text: 'Simmer.' }, { text: 'Strain.' }],
				},
				{ heading: 'To serve', steps: [{ text: 'Slice.' }] },
			])
		).toEqual([
			[
				[1, 2],
				[2, 2],
			],
			[
				[1, 3],
				[2, 3],
				[3, 3],
			],
			[[1, 1]],
		]);
	});

	it('counts on through a section without a heading, which nothing sets apart from the one above', () => {
		expect(
			numbers([
				{ heading: 'For the roast', steps: [{ text: 'Sear.' }, { text: 'Braise.' }] },
				{ steps: [{ text: 'Rest.' }] },
				{ heading: 'For the gravy', steps: [{ text: 'Whisk.' }] },
			])
		).toEqual([
			[
				[1, 3],
				[2, 3],
			],
			[[3, 3]],
			[[1, 1]],
		]);
	});

	it('keeps each section’s heading and steps as written', () => {
		expect(
			numberInstructionSteps([{ heading: 'For the gravy', steps: [{ text: 'Whisk.' }] }])
		).toEqual([
			{ heading: 'For the gravy', steps: [{ text: 'Whisk.', number: 1, lastNumber: 1 }] },
		]);
	});
});
