import { z } from 'zod';
import { hoursInMilliseconds } from '@/lib/dates';
import { settings } from '@/lib/settings';

// What cooking mode keeps on this device for each recipe: whether it is on and which rows are
// checked, so a reload, or a phone discarding the tab, finds the cook where they were. Pure, so the
// rules are tested without a browser. The progress belongs to the device rather than whoever is
// signed in, so its key sits outside the member prefix and signing out leaves it. An entry lasts
// settings.cooking.progressLifetimeHours past its last change, and an edit to the recipe, which may
// have moved its rows, starts it over.

// A row in the ingredients or the steps, by its section's index and its own within the section, so a
// rescaled line keeps its mark.
export type CookingRowKey = `${'ingredient' | 'step'}:${number}:${number}`;

export type CookingProgress = {
	on: boolean;
	checked: ReadonlySet<CookingRowKey>;
};

// The recipe whose progress is kept, at the version its page shows: when it was last edited.
export type CookingRecipe = {
	id: string;
	version: string;
};

// Cooking mode off with nothing checked, as every page renders on the server.
export const cookingOff: CookingProgress = { on: false, checked: new Set() };

const keyPrefix = 'cooking';

const indexSchema = z.int().nonnegative();

const entrySchema = z.object({
	version: z.string(),
	savedAt: z.iso.datetime(),
	on: z.boolean(),
	checked: z.array(
		z.templateLiteral([z.enum(['ingredient', 'step']), ':', indexSchema, ':', indexSchema])
	),
});

type CookingProgressEntry = z.infer<typeof entrySchema>;

export function cookingProgressKey(recipeId: string): string {
	return `${keyPrefix}:${recipeId}`;
}

export function ingredientRowKey(sectionIndex: number, lineIndex: number): CookingRowKey {
	return `ingredient:${sectionIndex}:${lineIndex}`;
}

export function stepRowKey(sectionIndex: number, stepIndex: number): CookingRowKey {
	return `step:${sectionIndex}:${stepIndex}`;
}

// Progress last changed before this time is discarded.
export function cookingProgressCutoff(now: Date): Date {
	return new Date(now.getTime() - hoursInMilliseconds(settings.cooking.progressLifetimeHours));
}

// The stored progress, or undefined where there is none, where it can't be read, where it has
// expired, or where it was kept for another version of the recipe.
export function readCookingProgress(
	entry: string | undefined,
	recipe: CookingRecipe,
	now: Date
): CookingProgress | undefined {
	if (entry === undefined) {
		return undefined;
	}
	let data: unknown;
	try {
		data = JSON.parse(entry);
	} catch {
		return undefined;
	}
	const result = entrySchema.safeParse(data);
	if (
		!result.success ||
		result.data.version !== recipe.version ||
		new Date(result.data.savedAt) < cookingProgressCutoff(now)
	) {
		return undefined;
	}
	return { on: result.data.on, checked: new Set(result.data.checked) };
}

// The entry to keep for the progress, or undefined where there is nothing to keep: cooking mode off
// with nothing checked.
export function cookingProgressEntry(
	progress: CookingProgress,
	recipe: CookingRecipe,
	now: Date
): string | undefined {
	if (!progress.on && progress.checked.size === 0) {
		return undefined;
	}
	const entry: CookingProgressEntry = {
		version: recipe.version,
		savedAt: now.toISOString(),
		on: progress.on,
		checked: [...progress.checked],
	};
	return JSON.stringify(entry);
}
