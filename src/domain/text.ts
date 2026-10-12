import { z } from 'zod';

// C0 controls and DEL, except tab, line feed, and carriage return: invisible, and NUL cannot be stored.
const controlCharacters = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

// Composed (NFC) like tags, so text that reads the same is stored the same and filters as one source.
function normalizeText(text: string): string {
	return text.replace(controlCharacters, '').normalize('NFC');
}

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
