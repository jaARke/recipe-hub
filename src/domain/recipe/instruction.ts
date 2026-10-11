import { z } from 'zod';
import { nonEmptyTextSchema } from '@/domain/recipe/text';

// An object rather than a string, so a step can gain fields without reshaping stored recipes.
export const instructionStepSchema = z.object({
	text: nonEmptyTextSchema,
});
export type InstructionStep = z.infer<typeof instructionStepSchema>;

export const instructionSectionSchema = z.object({
	heading: nonEmptyTextSchema.optional(),
	steps: z.array(instructionStepSchema).min(1, 'Add at least one step.'),
});
export type InstructionSection = z.infer<typeof instructionSectionSchema>;
