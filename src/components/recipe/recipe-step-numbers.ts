import type { InstructionSection, InstructionStep } from '@/domain/recipe/instruction';

type NumberedInstructionStep = InstructionStep & { number: number };

export type NumberedInstructionSection = Omit<InstructionSection, 'steps'> & {
	steps: NumberedInstructionStep[];
};

// A recipe's steps count from 1 straight through its sections, so a section's first step follows on
// from the last section's, on the recipe page, its printout, the cooking view, and the recipe form
// alike.
export function numberInstructionSteps(
	sections: readonly InstructionSection[]
): NumberedInstructionSection[] {
	let number = 0;
	return sections.map((section) => ({
		...section,
		steps: section.steps.map((step) => {
			number += 1;
			return { ...step, number };
		}),
	}));
}
