import type { z } from 'zod';
import { boundedTextSchema, plainTextSchema } from '@/domain/text';

// How a recipe schema treats the recipe limits in the settings, the fields content gained after some
// was stored, and the parts that follow from other fields. Content being written must meet the
// limits, hold those fields, and take the parts its other fields give, while stored content is read
// whatever the limits are now, without a field it predates, and with the parts it was stored with, so
// a lowered limit applies at the next edit and never keeps a recipe from loading.
export type ContentLimits = {
	// Text, plain unless another schema is given, of at most max characters.
	text(max: number, text?: z.ZodString): z.ZodString;
	// Whether a count is past its limit.
	exceeds(count: number, max: number): boolean;
	// Whether a field content gained after some was stored, such as an image's size, is missing.
	missing(value: unknown): boolean;
	// A value whose parts follow from the rest of it, such as an ingredient line's amount and item
	// from its text. Written content takes the parts derived, checked again, so the two never disagree.
	derived<Value>(
		schema: z.ZodType<Value, Value>,
		derive: (value: NoInfer<Value>) => NoInfer<Value>
	): z.ZodType<Value, Value>;
};

export const writtenContent: ContentLimits = {
	text: boundedTextSchema,
	exceeds: (count, max) => count > max,
	missing: (value) => value === undefined,
	derived: (schema, derive) => schema.overwrite(derive).pipe(schema),
};

export const storedContent: ContentLimits = {
	text: (_max, text = plainTextSchema) => text,
	exceeds: () => false,
	missing: () => false,
	derived: (schema) => schema,
};
