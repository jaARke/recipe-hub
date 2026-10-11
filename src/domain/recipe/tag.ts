import { z } from 'zod';

function uniqueTagLabels(labels: string[]): string[] {
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

export function normalizeTagLabel(label: string): string {
	return label.normalize('NFC').trim().replace(/\s+/g, ' ');
}

// A tag's identity: labels that differ only in case or spacing are the same tag.
export function tagKey(label: string): string {
	return normalizeTagLabel(label).toLowerCase();
}

export const tagLabelSchema = z.string().overwrite(normalizeTagLabel).min(1, 'Enter a tag.');

// Repeats of a tag are dropped, so the first spelling wins.
export const tagListSchema = z.array(tagLabelSchema).overwrite(uniqueTagLabels);
