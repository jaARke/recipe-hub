import type { z } from 'zod';
import { boundedTextSchema, plainTextSchema } from '@/domain/text';

// How a recipe schema treats the recipe limits in the settings, and the fields content gained after
// some was stored. Content being written must meet the limits and hold those fields, while stored
// content is read whatever the limits are now and without a field it predates, so a lowered limit
// applies at the next edit and never keeps a recipe from loading.
export type ContentLimits = {
	// Text, plain unless another schema is given, of at most max characters.
	text(max: number, text?: z.ZodString): z.ZodString;
	// Whether a count is past its limit.
	exceeds(count: number, max: number): boolean;
	// Whether a field content gained after some was stored, such as an image's size, is missing.
	missing(value: unknown): boolean;
};

export const writtenContent: ContentLimits = {
	text: boundedTextSchema,
	exceeds: (count, max) => count > max,
	missing: (value) => value === undefined,
};

export const storedContent: ContentLimits = {
	text: (_max, text = plainTextSchema) => text,
	exceeds: () => false,
	missing: () => false,
};
