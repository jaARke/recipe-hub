import { z } from 'zod';
import { normalizeText, withoutTrailingPunctuation } from '@/domain/text-normalization';

// What a label or a list leaves after a title or heading, as in "For the glaze:".
const headingSeparators = ';,:';

const andListFormat = new Intl.ListFormat('en-US', { type: 'conjunction' });

// Postgres text and jsonb cannot hold a NUL character, which a form or URL can still carry.
export function hasNoNul(text: string): boolean {
	return !text.includes('\0');
}

// What a blank field says, naming what it asks for, such as "Enter your display name." The browser
// checks a blank field before sending and says the same.
export function blankTextMessage(name: string): string {
	return `Enter ${name}.`;
}

// Text is trimmed and never blank; an optional text field is omitted rather than left empty. The
// name is what a blank one's message asks for, such as "your display name".
export function nonEmptyTextSchema(name: string): z.ZodString {
	return z.string().overwrite(normalizeText).trim().min(1, blankTextMessage(name));
}

// Text no form asks for by name, such as a model's name or a parsed ingredient's item.
export const plainTextSchema = nonEmptyTextSchema('some text');

// The text opening with a capital, as a label does: "cookies" is "Cookies".
export function sentenceCase(text: string): string {
	return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

// Items joined as a sentence lists them: "flour, sugar, and eggs".
export function andList(items: readonly string[]): string {
	return andListFormat.format(items);
}

// What every limit says when it is passed, such as "Use 12 photos or fewer."
export function limitMessage(max: number, units: string): string {
	return `Use ${max} ${units} or fewer.`;
}

// Text of at most max characters, measured once trimmed. Text other than plain text, such as a tag
// or a field a form asks for by name, passes its own schema.
export function boundedTextSchema(max: number, text: z.ZodString = plainTextSchema): z.ZodString {
	return text.max(max, limitMessage(max, 'characters'));
}

// A title or a section heading, without the separators that end it. Text of nothing else keeps them,
// so a heading is never left blank once it passed as text. The name is what a blank one asks for.
export function headingTextSchema(name: string): z.ZodString {
	return nonEmptyTextSchema(name).overwrite(
		(text) => withoutTrailingPunctuation(text, headingSeparators) || text
	);
}

// A section's heading, which no form asks for by name.
export const sectionHeadingTextSchema = headingTextSchema('some text');
