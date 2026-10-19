import { z } from 'zod';
import type { EditedRecipe } from '@/components/recipe-form/recipe-form-fields';
import {
	loadedPhotos,
	recipeFormSnapshotSchema,
	type RecipeFormSnapshot,
} from '@/components/recipe-form/recipe-form-snapshot';
import type { RecipeFormValues } from '@/components/recipe-form/recipe-form-values';
import { importDraftCutoff } from '@/domain/recipe/recipe-import';
import { memberBrowserStorageKey } from '@/lib/browser-storage';
import { daysInMilliseconds } from '@/lib/dates';
import { settings } from '@/lib/settings';

// What the recipe form keeps in the browser as the member edits it, so a reload, a closed tab, or a
// tab the phone discarded gives back what they entered. Pure, so the rules are tested without a
// browser. Each entry is the member's own, keyed by their id, so another account signed in on the
// browser never finds it; it records when it was written, and goes once it is as old as a saved
// draft's lifetime, or once what it edits is gone.

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

// What a form finds kept for it: changes to bring back, or changes made to another version of what
// it edits, as when another page saved the recipe or the draft since, which never come back over it.
export type KeptRecipeForm = { status: 'current' | 'outdated'; entry: AutosavedRecipeForm };

// What a page knows still exists of what the member's forms edit, so a form's load removes the
// member's entries for the rest: the imports whose reviews they can still open, and the recipes there
// are. Each list, where given, names every one.
export type ExistingRecipeFormSubjects = {
	// When the page found out, so an entry written since, as by another tab, is kept.
	knownAt: Date;
	importIds?: readonly string[];
	recipeIds?: readonly string[];
};

// What a form's load prunes kept entries by: the time, the member signed in, and what their page
// knows still exists.
export type RecipeFormPruning = {
	now: Date;
	memberId: string;
	existing?: ExistingRecipeFormSubjects;
};

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

// The member and the subject a key names, as recipeFormAutosaveKey makes it, or undefined for a key
// it never makes, as one from before entries named their member.
function keyOwner(key: string): { memberId: string; subject: RecipeFormEntrySubject } | undefined {
	const [memberId = '', kind, id = ''] = key.slice(keyPrefix.length).split(':');
	const subject = entrySubject(kind, id);
	return subject !== undefined && recipeFormAutosaveKey(memberId, subject) === key
		? { memberId, subject }
		: undefined;
}

function entrySubject(kind: string | undefined, id: string): RecipeFormEntrySubject | undefined {
	switch (kind) {
		case 'new':
			return { kind: 'new' };
		case 'import':
			return { kind: 'import', importId: id };
		case 'draft':
			return { kind: 'draft', draftId: id };
		case 'recipe':
			return { kind: 'recipe', recipeId: id };
		default:
			return undefined;
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
	return new Date(now.getTime() - daysInMilliseconds(settings.drafts.draftLifetimeDays));
}

// What the stored entry keeps for the form, by the version of what it edits that the form has, or
// undefined where there is none, where it can't be read (as after a change to what the form keeps),
// or where it has expired.
export function readAutosavedRecipeForm(
	entry: string | undefined,
	version: string | undefined,
	now: Date
): KeptRecipeForm | undefined {
	const read = entry === undefined ? undefined : parseEntry(entry);
	if (read === undefined || isExpired(read, now)) {
		return undefined;
	}
	return { status: read.version === version ? 'current' : 'outdated', entry: read };
}

function isExpired(entry: AutosavedRecipeForm, now: Date): boolean {
	return new Date(entry.writtenAt) < autosaveCutoff(now);
}

// The prefix of every member's entries, which a form's load prunes.
export const recipeFormAutosavePrefix = keyPrefix;

// Whether the entry under a key is of no more use: one that can't be read, as an entry from before a
// change to what the form keeps; one past its lifetime, for a page this browser never opens again; any
// member's for an import, written longer ago than an import's draft lasts, as its review has closed
// since; or the member's for an import or a recipe their page knows is gone, written before it knew.
export function isStaleRecipeFormEntry(
	key: string,
	entry: string,
	{ now, memberId, existing }: RecipeFormPruning
): boolean {
	const read = parseEntry(entry);
	if (read === undefined || isExpired(read, now)) {
		return true;
	}
	const owner = keyOwner(key);
	const writtenAt = new Date(read.writtenAt);
	if (owner?.subject.kind === 'import' && writtenAt < importDraftCutoff(now)) {
		return true;
	}
	if (owner?.memberId !== memberId || existing === undefined || writtenAt >= existing.knownAt) {
		return false;
	}
	switch (owner.subject.kind) {
		case 'import':
			return existing.importIds?.includes(owner.subject.importId) === false;
		case 'recipe':
			return existing.recipeIds?.includes(owner.subject.recipeId) === false;
		default:
			return false;
	}
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
