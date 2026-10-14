'use client';

import * as React from 'react';
import { isPhotoStored } from '@/components/recipe-form/photo-upload';
import {
	autosavedRecipeForm,
	isAsLoaded,
	readAutosavedRecipeForm,
	recipeFormAutosaveKey,
	recipeFormAutosaveVersion,
	restoredRecipeForm,
	unsavedUploads,
	type RecipeFormSubject,
	type UnsavedUpload,
} from '@/components/recipe-form/recipe-form-autosave';
import type { RecipeFormEdit, RecipeFormValues } from '@/components/recipe-form/recipe-form-values';
import {
	readBrowserStorage,
	removeBrowserStorage,
	writeBrowserStorage,
} from '@/lib/browser-storage';

type RecipeFormAutosaveOptions = {
	// Absent where the form keeps nothing, as in the design reference.
	subject: RecipeFormSubject | undefined;
	initial: RecipeFormValues;
	values: RecipeFormValues;
	dispatch: React.Dispatch<RecipeFormEdit>;
	// Runs as the stored changes come back.
	onRestore: () => void;
};

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
// form first shows, not again when a hidden page shows. Writing waits until they are back, so the
// form as it loads never replaces them, and a form back to how it loaded keeps nothing. They come
// back at once, and a lookup that then finds an upload gone changes only its photo, so nothing typed
// meanwhile is lost. Changes that came back are the draft's state rather than what an attempt said,
// so they stay marked restored until the member discards them. clear removes the entry, as a save
// that leads away must first.
export function useRecipeFormAutosave({
	subject,
	initial,
	values,
	dispatch,
	onRestore,
}: RecipeFormAutosaveOptions) {
	const key = subject === undefined ? undefined : recipeFormAutosaveKey(subject);
	const version = subject === undefined ? undefined : recipeFormAutosaveVersion(subject);
	// Whether the entry has been read, and brought back if there was one.
	const [settled, setSettled] = React.useState(key === undefined);
	const [restored, setRestored] = React.useState(false);
	const read = React.useRef(false);
	// The entry last written, so an edit that changes nothing kept, such as an upload's progress,
	// writes nothing.
	const written = React.useRef<string | undefined>(undefined);
	const loadedEntry = React.useMemo(
		() => autosavedRecipeForm(initial, version),
		[initial, version]
	);

	const restore = React.useEffectEvent(async (storageKey: string) => {
		const entry = readBrowserStorage(storageKey);
		const stored = readAutosavedRecipeForm(entry, version);
		if (stored === undefined) {
			// An entry the form can't read, or one about another version of the recipe, is of no use.
			if (entry !== undefined) {
				removeBrowserStorage(storageKey);
			}
			setSettled(true);
			return;
		}
		dispatch({ type: 'replaceForm', values: restoredRecipeForm(stored, initial) });
		setRestored(true);
		setSettled(true);
		onRestore();
		for (const photoId of await missingUploads(unsavedUploads(stored, initial))) {
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
		const entry = autosavedRecipeForm(values, version);
		const json = JSON.stringify(entry);
		if (json === written.current) {
			return;
		}
		written.current = json;
		if (isAsLoaded(entry, loadedEntry)) {
			removeBrowserStorage(key);
		} else {
			writeBrowserStorage(key, json);
		}
	}, [key, version, settled, values, loadedEntry]);

	function clear() {
		if (key !== undefined) {
			removeBrowserStorage(key);
			written.current = undefined;
		}
	}

	// Takes the form back to how it loaded.
	function discard() {
		clear();
		dispatch({ type: 'replaceForm', values: initial });
		setRestored(false);
	}

	return { restored, discard, clear };
}
