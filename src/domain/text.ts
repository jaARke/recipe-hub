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
