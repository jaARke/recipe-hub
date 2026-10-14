import { z } from 'zod';
import { normalizeText } from '@/domain/text-normalization';

// Postgres text and jsonb cannot hold a NUL character, which a form or URL can still carry.
export function hasNoNul(text: string): boolean {
	return !text.includes('\0');
}

// Text is trimmed and never blank; an optional text field is omitted rather than left empty.
export const nonEmptyTextSchema = z
	.string()
	.overwrite(normalizeText)
	.trim()
	.min(1, 'Enter some text.');

// What every limit says when it is passed, such as "Use 12 photos or fewer."
export function limitMessage(max: number, units: string): string {
	return `Use ${max} ${units} or fewer.`;
}

// Text of at most max characters, measured once trimmed. Text other than plain text, such as a tag,
// passes its own schema.
export function boundedTextSchema(
	max: number,
	text: z.ZodString = nonEmptyTextSchema
): z.ZodString {
	return text.max(max, limitMessage(max, 'characters'));
}
