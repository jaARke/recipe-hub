import { z } from 'zod';
import type { EditedRecipe } from '@/components/recipe-form/recipe-form-fields';
import {
	loadedPhotos,
	recipeFormSnapshotSchema,
	type RecipeFormSnapshot,
} from '@/components/recipe-form/recipe-form-snapshot';
import type { RecipeFormValues } from '@/components/recipe-form/recipe-form-values';
import { memberBrowserStorageKey } from '@/lib/browser-storage';
import { daysInMilliseconds } from '@/lib/dates';
import { settings } from '@/lib/settings';

// What the recipe form keeps in the browser as the member edits it, so a reload, a closed tab, or a
// tab the phone discarded gives back what they entered. Pure, so the rules are tested without a
// browser. Each entry is the member's own, keyed by their id, so another account signed in on the
// browser never finds it; it records when it was written, and goes once it is as old as a saved
// draft's lifetime.

// What a form edits, which names its entry: a new recipe, an import's draft under review, a draft the
// member saved, or a recipe.
export type RecipeFormEntrySubject =
	| { kind: 'new' }
	| { kind: 'import'; importId: string }
	| { kind: 'draft'; draftId: string }
	| { kind: 'recipe'; recipeId: string };

// The subject with the version of it the form loaded or last saved, which its entry records: a
// recipe's, a saved draft's, and an import's once its review holds a saved draft.
export type RecipeFormSubject =
	| { kind: 'new' }
	| { kind: 'import'; importId: string; version?: string }
	| { kind: 'draft'; draftId: string; version: string }
	| { kind: 'recipe'; recipeId: string; version: string };

const keyPrefix = memberBrowserStorageKey('recipe-form:');

const entrySchema = z.object({
	// The version of what the form edits as it loaded or last saved it, where it has one.
	version: z.string().optional(),
	writtenAt: z.iso.datetime(),
	form: recipeFormSnapshotSchema,
});

export type AutosavedRecipeForm = z.infer<typeof entrySchema>;

// An upload stored since the form loaded, by the photo that shows it.
export type UnsavedUpload = { photoId: number; pathname: string };

// One entry for each form and member, so an entry for an older version of what it edits is replaced.
// The key names the recipe or draft and not the version, so its entry is found without one.
export function recipeFormAutosaveKey(memberId: string, subject: RecipeFormEntrySubject): string {
	const member = `${keyPrefix}${memberId}:`;
	switch (subject.kind) {
		case 'new':
			return `${member}new`;
		case 'import':
			return `${member}import:${subject.importId}`;
		case 'draft':
			return `${member}draft:${subject.draftId}`;
		case 'recipe':
			return `${member}recipe:${subject.recipeId}`;
	}
}

// The version an entry names, so changes made to one version never come back over another, as when
// another page saved the recipe or the draft since.
export function recipeFormAutosaveVersion(subject: RecipeFormSubject): string | undefined {
	return subject.kind === 'new' ? undefined : subject.version;
}

// What the form edits, from what it is given: a recipe to edit, a saved draft, an import to review,
// or none of them. A saved draft that continues an import is named by the import, as its review
// always opens it. A saved draft's version is when it was last saved.
export function recipeFormSubject({
	editing,
	importId,
	draft,
}: {
	editing?: Pick<EditedRecipe, 'id' | 'version'>;
	importId?: string;
	draft?: { id: string; savedAt: Date };
}): RecipeFormSubject {
	if (editing !== undefined) {
		return { kind: 'recipe', recipeId: editing.id, version: editing.version };
	}
	if (importId !== undefined) {
		return draft === undefined
			? { kind: 'import', importId }
			: { kind: 'import', importId, version: draft.savedAt.toISOString() };
	}
	return draft === undefined
		? { kind: 'new' }
		: { kind: 'draft', draftId: draft.id, version: draft.savedAt.toISOString() };
}

// The entry for the form as it now is, written at the given moment.
export function autosavedRecipeForm(
	form: RecipeFormSnapshot,
	version: string | undefined,
	writtenAt: Date
): AutosavedRecipeForm {
	return { version, writtenAt: writtenAt.toISOString(), form };
}

function parseEntry(entry: string): AutosavedRecipeForm | undefined {
	let data: unknown;
	try {
		data = JSON.parse(entry);
	} catch {
		return undefined;
	}
	const result = entrySchema.safeParse(data);
	return result.success ? result.data : undefined;
}

// Entries written before this time have expired.
function autosaveCutoff(now: Date): Date {
	return new Date(now.getTime() - daysInMilliseconds(settings.drafts.savedDraftLifetimeDays));
}

// The stored entry, or undefined where there is none, where it can't be read (as after a change to
// what the form keeps), where it has expired, or where it is about another version of the recipe.
export function readAutosavedRecipeForm(
	entry: string | undefined,
	version: string | undefined,
	now: Date
): AutosavedRecipeForm | undefined {
	const read = entry === undefined ? undefined : parseEntry(entry);
	return read !== undefined && read.version === version && !isExpired(read, now) ? read : undefined;
}

function isExpired(entry: AutosavedRecipeForm, now: Date): boolean {
	return new Date(entry.writtenAt) < autosaveCutoff(now);
}

// The prefix of every member's entries, which a form's load prunes.
export const recipeFormAutosavePrefix = keyPrefix;

// Whether a kept entry is of no more use: one that can't be read, as an entry from before a change to
// what the form keeps, or one past its lifetime, for a page this browser never opens again.
export function isStaleRecipeFormEntry(entry: string, now: Date): boolean {
	const read = parseEntry(entry);
	return read === undefined || isExpired(read, now);
}

// The stored uploads the form didn't load with. The image sweep removes an upload a day after nothing
// names it, so each is looked up once it is back.
export function unsavedUploads(
	stored: RecipeFormSnapshot,
	initial: RecipeFormValues
): UnsavedUpload[] {
	const loaded = loadedPhotos(initial);
	return [...stored.photos.dish, ...stored.photos.scan].flatMap(({ id, pathname }) =>
		pathname === undefined || loaded.has(pathname) ? [] : [{ photoId: id, pathname }]
	);
}
