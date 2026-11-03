import type { InstructionSection, InstructionStep } from '@/domain/recipe/instruction';

type NumberedInstructionStep = InstructionStep & { number: number };

export type NumberedInstructionSection = Omit<InstructionSection, 'steps'> & {
	steps: NumberedInstructionStep[];
};

// A recipe's steps count from 1 again under each heading, so "For the gravy" starts at step 1, on
// the recipe page, its printout, and the cooking view alike.
export function numberInstructionSteps(
	sections: readonly InstructionSection[]
): NumberedInstructionSection[] {
	return sections.map((section) => ({
		...section,
		steps: section.steps.map((step, index) => ({ ...step, number: index + 1 })),
	}));
}
