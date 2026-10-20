'use client';

import * as React from 'react';
import { isPhotoStored } from '@/components/recipe-form/photo-upload';
import {
	autosavedRecipeForm,
	isStaleRecipeFormEntry,
	readAutosavedRecipeForm,
	recipeFormAutosaveKey,
	recipeFormAutosavePrefix,
	unsavedUploads,
	type ExistingRecipeFormSubjects,
	type RecipeFormEntrySubject,
	type RecipeFormSubject,
	type UnsavedUpload,
} from '@/components/recipe-form/recipe-form-autosave';
import {
	recipeFormSnapshot,
	restoredRecipeForm,
	showSameRecipeForm,
} from '@/components/recipe-form/recipe-form-snapshot';
import {
	editRecipeForm,
	type RecipeFormEdit,
	type RecipeFormValues,
} from '@/components/recipe-form/recipe-form-values';
import {
	readBrowserStorage,
	removeBrowserStorage,
	removeBrowserStorageWhere,
	writeBrowserStorage,
} from '@/lib/browser-storage';

type RecipeFormAutosaveOptions = {
	// The member signed in, whose entries these are; absent where the form keeps nothing, as in the
	// design reference.
	memberId: string | undefined;
	// The recipe the form edits; absent where the form keeps nothing, as for a recipe being added, which
	// saves as a draft.
	subject: RecipeFormSubject | undefined;
	// What the page knows still exists of what the member's forms edit, which prunes their entries.
	existing?: ExistingRecipeFormSubjects;
	// The form as it loaded, which Discard returns to.
	baseline: RecipeFormValues;
	values: RecipeFormValues;
	// Whether the values show the member just what the baseline does.
	unchanged: boolean;
	dispatch: React.Dispatch<RecipeFormEdit>;
	// Runs as the stored changes come back, with when they were made.
	onRestore: (restoredAt: Date) => void;
	// Runs as stored changes made to an earlier version of what the form edits are dropped, with when
	// they were made.
	onOutdated: (outdatedAt: Date) => void;
};

// What was last written; no form where the entry was removed.
type Written = { form: string | undefined };

// The photos whose uploads the image route says are gone. One it can't answer for stays, and saving
// says if it is gone.
async function missingUploads(uploads: readonly UnsavedUpload[]): Promise<number[]> {
	const missing = await Promise.all(
		uploads.map(async ({ photoId, pathname }) => {
			try {
				return (await isPhotoStored(pathname)) ? [] : [photoId];
			} catch {
				return [];
			}
		})
	);
	return missing.flat();
}

// Keeps the form's unsaved changes in this browser as the member edits, and brings them back as the
// form first shows, not again when a hidden page shows. Stale entries go first: any member's past
// their lifetime, and the member's for what the page knows is gone. Changes made to an earlier
// version of what the form edits never come back; where they show something the form doesn't, the
// form says so, once, as their entry goes.
// Writing waits until the changes are back, so the form as it loads never replaces them, and a form
// that shows what its baseline does keeps nothing. Changes come back only where they show something
// the baseline doesn't, at once, and a lookup that then finds an upload gone changes only its photo,
// so nothing typed meanwhile is lost. Restored changes count as written, so their entry keeps when
// they were made until the member edits, and they stay marked restored, with that time, until the
// member discards them or the form shows its baseline again. leave removes the entry, as a save that
// leads away must first; the page Next keeps still holds the values, so they count as written and
// showing the page again never writes them back.
export function useRecipeFormAutosave({
	memberId,
	subject,
	existing,
	baseline,
	values,
	unchanged,
	dispatch,
	onRestore,
	onOutdated,
}: RecipeFormAutosaveOptions) {
	const key =
		memberId === undefined || subject === undefined
			? undefined
			: recipeFormAutosaveKey(memberId, subject);
	const version = subject?.version;
	// Whether the entry has been read, and brought back if there was one.
	const [settled, setSettled] = React.useState(key === undefined);
	const [restoredAt, setRestoredAt] = React.useState<Date>();
	// When the changes the form dropped for being made to an earlier version were made.
	const [outdatedAt, setOutdatedAt] = React.useState<Date>();
	const read = React.useRef(false);
	// So an edit that changes nothing kept, such as an upload's progress, writes nothing.
	const written = React.useRef<Written | undefined>(undefined);

	if (restoredAt !== undefined && unchanged) {
		setRestoredAt(undefined);
	}

	const restore = React.useEffectEvent(
		async (storageKey: string, member: string, version: string) => {
			const now = new Date();
			removeBrowserStorageWhere(recipeFormAutosavePrefix, (entry, entryKey) =>
				isStaleRecipeFormEntry(entryKey, entry, { now, memberId: member, existing })
			);
			const entry = readBrowserStorage(storageKey);
			const kept = readAutosavedRecipeForm(entry, version, now);
			const showsNew =
				kept !== undefined && !showSameRecipeForm(kept.entry.form, recipeFormSnapshot(baseline));
			if (kept?.status !== 'current' || !showsNew) {
				// One that shows nothing new is of no use, and one about another version never comes back.
				if (entry !== undefined) {
					removeBrowserStorage(storageKey);
				}
				if (kept?.status === 'outdated' && showsNew) {
					const madeAt = new Date(kept.entry.writtenAt);
					setOutdatedAt(madeAt);
					onOutdated(madeAt);
				}
				setSettled(true);
				return;
			}
			const stored = kept.entry;
			const writtenAt = new Date(stored.writtenAt);
			const restored = editRecipeForm(values, {
				type: 'replaceForm',
				values: restoredRecipeForm(stored.form, baseline),
			});
			written.current = { form: JSON.stringify(recipeFormSnapshot(restored)) };
			dispatch({ type: 'replaceForm', values: restored });
			setRestoredAt(writtenAt);
			setSettled(true);
			onRestore(writtenAt);
			for (const photoId of await missingUploads(unsavedUploads(stored.form, baseline))) {
				dispatch({ type: 'failMissingUpload', photoId });
			}
		}
	);

	React.useEffect(() => {
		if (key === undefined || memberId === undefined || version === undefined || read.current) {
			return;
		}
		read.current = true;
		void restore(key, memberId, version);
	}, [key, memberId, version]);

	React.useEffect(() => {
		if (key === undefined || version === undefined || !settled) {
			return;
		}
		const snapshot = recipeFormSnapshot(values);
		const form = unchanged ? undefined : JSON.stringify(snapshot);
		const last = written.current;
		if (last !== undefined && last.form === form) {
			return;
		}
		written.current = { form };
		if (form === undefined) {
			removeBrowserStorage(key);
		} else {
			writeBrowserStorage(key, JSON.stringify(autosavedRecipeForm(snapshot, version, new Date())));
		}
	}, [key, version, settled, values, unchanged]);

	// Takes the form back to its baseline.
	function discard() {
		if (key !== undefined) {
			removeBrowserStorage(key);
		}
		dispatch({ type: 'replaceForm', values: baseline });
		setRestoredAt(undefined);
	}

	function leave() {
		if (key === undefined) {
			return;
		}
		removeBrowserStorage(key);
		written.current = { form: unchanged ? undefined : JSON.stringify(recipeFormSnapshot(values)) };
	}

	return { restoredAt, outdatedAt, discard, leave };
}

// Removes the member's unsaved changes to what a form edits, as deleting it from its page's menu
// does.
export function removeRecipeFormChanges(memberId: string, subject: RecipeFormEntrySubject): void {
	removeBrowserStorage(recipeFormAutosaveKey(memberId, subject));
}
