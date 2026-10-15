'use client';

import * as React from 'react';
import { isPhotoStored } from '@/components/recipe-form/photo-upload';
import {
	autosavedRecipeForm,
	isStaleRecipeFormEntry,
	readAutosavedRecipeForm,
	recipeFormAutosaveKey,
	recipeFormAutosavePrefix,
	recipeFormAutosaveVersion,
	unsavedUploads,
	type RecipeFormSubject,
	type UnsavedUpload,
} from '@/components/recipe-form/recipe-form-autosave';
import {
	recipeFormSnapshot,
	restoredRecipeForm,
	showSameRecipeForm,
} from '@/components/recipe-form/recipe-form-snapshot';
import type { RecipeFormEdit, RecipeFormValues } from '@/components/recipe-form/recipe-form-values';
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
	subject: RecipeFormSubject;
	// The form as it loaded, or as its draft was last saved, which Discard returns to.
	baseline: RecipeFormValues;
	values: RecipeFormValues;
	// Whether the values show the member just what the baseline does.
	unchanged: boolean;
	dispatch: React.Dispatch<RecipeFormEdit>;
	// Runs as the stored changes come back, with when they were made.
	onRestore: (restoredAt: Date) => void;
};

// What was last written, and under which key; no form where the entry was removed.
type Written = { key: string; form: string | undefined };

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
// form first shows, not again when a hidden page shows. Expired entries, any member's, go first.
// Writing waits until the changes are back, so the form as it loads never replaces them, and a form
// that shows what its baseline does keeps nothing. Changes come back only where they show something
// the baseline doesn't, at once, and a lookup that then finds an upload gone changes only its photo,
// so nothing typed meanwhile is lost. They stay marked restored, with when they were made, until the
// member discards them or the form shows its baseline again. leave removes the entry, as a save that
// leads away must first; the page Next keeps still holds the values, so they count as written and
// showing the page again never writes them back.
export function useRecipeFormAutosave({
	memberId,
	subject,
	baseline,
	values,
	unchanged,
	dispatch,
	onRestore,
}: RecipeFormAutosaveOptions) {
	const key = memberId === undefined ? undefined : recipeFormAutosaveKey(memberId, subject);
	const version = recipeFormAutosaveVersion(subject);
	// Whether the entry has been read, and brought back if there was one.
	const [settled, setSettled] = React.useState(key === undefined);
	const [restoredAt, setRestoredAt] = React.useState<Date>();
	const read = React.useRef(false);
	// So an edit that changes nothing kept, such as an upload's progress, writes nothing.
	const written = React.useRef<Written | undefined>(undefined);

	if (restoredAt !== undefined && unchanged) {
		setRestoredAt(undefined);
	}

	const restore = React.useEffectEvent(async (storageKey: string) => {
		const now = new Date();
		removeBrowserStorageWhere(recipeFormAutosavePrefix, (entry) =>
			isStaleRecipeFormEntry(entry, now)
		);
		const entry = readBrowserStorage(storageKey);
		const stored = readAutosavedRecipeForm(entry, version, now);
		if (stored === undefined || showSameRecipeForm(stored.form, recipeFormSnapshot(baseline))) {
			// An entry about another version of the recipe, or one that shows nothing new, is of no use.
			if (entry !== undefined) {
				removeBrowserStorage(storageKey);
			}
			setSettled(true);
			return;
		}
		const writtenAt = new Date(stored.writtenAt);
		dispatch({ type: 'replaceForm', values: restoredRecipeForm(stored.form, baseline) });
		setRestoredAt(writtenAt);
		setSettled(true);
		onRestore(writtenAt);
		for (const photoId of await missingUploads(unsavedUploads(stored.form, baseline))) {
			dispatch({ type: 'failMissingUpload', photoId });
		}
	});

	React.useEffect(() => {
		if (key === undefined || read.current) {
			return;
		}
		read.current = true;
		void restore(key);
	}, [key]);

	React.useEffect(() => {
		if (key === undefined || !settled) {
			return;
		}
		const last = written.current;
		// The entry follows the form to its new key, as a new recipe's does once saved as a draft.
		if (last !== undefined && last.key !== key) {
			removeBrowserStorage(last.key);
		}
		const snapshot = recipeFormSnapshot(values);
		const form = unchanged ? undefined : JSON.stringify(snapshot);
		if (last?.key === key && last.form === form) {
			return;
		}
		written.current = { key, form };
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
		written.current = {
			key,
			form: unchanged ? undefined : JSON.stringify(recipeFormSnapshot(values)),
		};
	}

	return { restoredAt, discard, leave };
}
