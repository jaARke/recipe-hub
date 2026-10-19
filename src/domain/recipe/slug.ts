import { z } from 'zod';

// Long enough for a descriptive title while keeping shared links readable.
const maxSlugLength = 60;

const fallbackSlug = 'recipe';

// Latin letters that Unicode decomposition leaves intact.
const foldedLetters: Readonly<Record<string, string>> = {
	æ: 'ae',
	ð: 'd',
	đ: 'd',
	ı: 'i',
	ł: 'l',
	ø: 'o',
	œ: 'oe',
	ß: 'ss',
	þ: 'th',
};

function truncateSlug(slug: string, maxLength: number): string {
	if (slug.length <= maxLength) {
		return slug;
	}

	// The character just past the cut is included so a hyphen there counts as a word boundary.
	const boundary = slug.slice(0, maxLength + 1).lastIndexOf('-');
	return boundary > 0 ? slug.slice(0, boundary) : slug.slice(0, maxLength);
}

export const slugSchema = z
	.string()
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers, and single hyphens.');

// The text in a slug's letters, digits and hyphens, uncapped and possibly empty, so text compared by it
// ignores case, accents and punctuation.
export function slugKey(text: string): string {
	return (
		text
			.normalize('NFKD')
			.replace(/[\u0300-\u036f]/g, '')
			.toLowerCase()
			// Dropped rather than hyphenated, so "Grandma's" reads "grandmas".
			.replace(/['\u2019]/g, '')
			.replace(/[^a-z0-9]/gu, (character) => foldedLetters[character] ?? '-')
			.replace(/-+/g, '-')
			.replace(/^-|-$/g, '')
	);
}

export function slugify(title: string): string {
	const slug = slugKey(title);
	return slug === '' ? fallbackSlug : truncateSlug(slug, maxSlugLength);
}

// Attempt 1 is the base itself; later attempts append their number to resolve a collision.
export function slugCandidate(base: string, attempt: number): string {
	if (!Number.isInteger(attempt) || attempt < 1) {
		throw new RangeError('A slug attempt must be a positive integer');
	}

	if (attempt === 1) {
		return base;
	}

	const suffix = `-${attempt}`;
	return `${truncateSlug(base, maxSlugLength - suffix.length)}${suffix}`;
}
