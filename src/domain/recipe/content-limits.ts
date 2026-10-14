import type { z } from 'zod';
import { boundedTextSchema, plainTextSchema } from '@/domain/text';

// How a recipe schema treats the recipe limits in the settings. Content being written must meet them,
// while stored content is read whatever they are now, so a lowered limit applies at the next edit and
// never keeps a recipe from loading.
export type ContentLimits = {
	// Text, plain unless another schema is given, of at most max characters.
	text(max: number, text?: z.ZodString): z.ZodString;
	// Whether a count is past its limit.
	exceeds(count: number, max: number): boolean;
};

export const writtenContent: ContentLimits = {
	text: boundedTextSchema,
	exceeds: (count, max) => count > max,
};

export const storedContent: ContentLimits = {
	text: (_max, text = plainTextSchema) => text,
	exceeds: () => false,
};
