import { z } from 'zod';
import type { CookingRecipe } from '@/components/cooking/cooking-screens';

// The ingredients a cook has checked off, kept in the tab's storage until the tab closes, so a
// reload, or a phone discarding the tab, finds them while another tab starts with none. Pure, so the
// rules are tested without a browser. Each version of a recipe has its own entry: an edit, which may
// have moved its lines, starts the checks over.

// An ingredient line by its section's index and its own within the section, so a rescaled line keeps
// its check.
export type CookingCheckKey = `${number}:${number}`;

export type CookingChecksRecipe = Pick<CookingRecipe, 'id' | 'version'>;

export const noCookingChecks: ReadonlySet<CookingCheckKey> = new Set();

const entrySchema = z.array(
	// A template literal holds each number to a whole one but not to its sign, so the pattern does.
	z.templateLiteral([z.int(), ':', z.int()]).refine((key) => /^\d+:\d+$/u.test(key))
);

export function cookingChecksKey({ id, version }: CookingChecksRecipe): string {
	return `cooking:${id}:${version}`;
}

export function ingredientCheckKey(sectionIndex: number, lineIndex: number): CookingCheckKey {
	return `${sectionIndex}:${lineIndex}`;
}

// How many of the recipe's lines are checked, of how many it has.
export function countCheckedLines(
	ingredientSections: CookingRecipe['ingredientSections'],
	checked: ReadonlySet<CookingCheckKey>
): { checked: number; total: number } {
	const keys = ingredientSections.flatMap((section, sectionIndex) =>
		section.lines.map((_, lineIndex) => ingredientCheckKey(sectionIndex, lineIndex))
	);
	return { checked: keys.filter((key) => checked.has(key)).length, total: keys.length };
}

// The checks kept in the entry, or none where there is no entry or it can't be read.
export function readCookingChecks(entry: string | undefined): ReadonlySet<CookingCheckKey> {
	if (entry === undefined) {
		return noCookingChecks;
	}
	let data: unknown;
	try {
		data = JSON.parse(entry);
	} catch {
		return noCookingChecks;
	}
	const result = entrySchema.safeParse(data);
	return result.success ? new Set(result.data) : noCookingChecks;
}

// The entry to keep for the checks, or undefined where nothing is checked and nothing need be kept.
export function cookingChecksEntry(checked: ReadonlySet<CookingCheckKey>): string | undefined {
	return checked.size === 0 ? undefined : JSON.stringify([...checked]);
}
