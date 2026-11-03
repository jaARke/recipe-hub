import type { InstructionSection, InstructionStep } from '@/domain/recipe/instruction';

type NumberedInstructionStep = InstructionStep & {
	number: number;
	// The last number in its count: how many steps are under its heading, or before the first.
	lastNumber: number;
};

export type NumberedInstructionSection = Omit<InstructionSection, 'steps'> & {
	steps: NumberedInstructionStep[];
};

// The sections each count runs through: a heading starts one, and a section without a heading joins
// the one above it, since nothing on the page sets it apart.
function countedSections(sections: readonly InstructionSection[]): InstructionSection[][] {
	const counts: InstructionSection[][] = [];
	for (const section of sections) {
		const last = counts.at(-1);
		if (last === undefined || section.heading !== undefined) {
			counts.push([section]);
		} else {
			last.push(section);
		}
	}
	return counts;
}

// A recipe's steps count from 1 again after each heading, so "For the gravy" starts at step 1, on
// the recipe page, its printout, and the cooking view alike.
export function numberInstructionSteps(
	sections: readonly InstructionSection[]
): NumberedInstructionSection[] {
	return countedSections(sections).flatMap((counted) => {
		const lastNumber = counted.reduce((count, section) => count + section.steps.length, 0);
		let number = 0;
		return counted.map((section) => ({
			...section,
			steps: section.steps.map((step) => {
				number += 1;
				return { ...step, number, lastNumber };
			}),
		}));
	});
}
