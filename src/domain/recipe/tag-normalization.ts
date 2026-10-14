import { normalizeText } from '@/domain/text-normalization';

// Tidied as every text field is, then with each run of whitespace as one space.
export function normalizeTagLabel(label: string): string {
	return normalizeText(label).trim().replace(/\s+/g, ' ');
}

// A tag's identity: labels that differ only in case or spacing are the same tag.
export function tagKey(label: string): string {
	return normalizeTagLabel(label).toLowerCase();
}

// Repeats of a tag are dropped, so the first spelling wins.
export function uniqueTagLabels(labels: readonly string[]): string[] {
	const seen = new Set<string>();
	return labels.filter((label) => {
		const key = tagKey(label);
		if (seen.has(key)) {
			return false;
		}
		seen.add(key);
		return true;
	});
}
