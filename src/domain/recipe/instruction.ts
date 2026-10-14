import { z } from 'zod';
import type { ContentLimits } from '@/domain/recipe/content-limits';
import { sectionHeadingTextSchema } from '@/domain/text';
import { settings } from '@/lib/settings';

// An object rather than a string, so a step can gain fields without reshaping stored recipes.
export function instructionStepSchemaFor(limits: ContentLimits) {
	return z.object({
		text: limits.text(settings.recipeLimits.maxStepLength),
	});
}
export type InstructionStep = z.infer<ReturnType<typeof instructionStepSchemaFor>>;

export function instructionSectionSchemaFor(limits: ContentLimits) {
	return z.object({
		heading: limits
			.text(settings.recipeLimits.maxSectionHeadingLength, sectionHeadingTextSchema)
			.optional(),
		steps: z.array(instructionStepSchemaFor(limits)).min(1, 'Add at least one step.'),
	});
}
export type InstructionSection = z.infer<ReturnType<typeof instructionSectionSchemaFor>>;
