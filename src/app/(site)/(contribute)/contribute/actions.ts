'use server';

import { refresh, updateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { toFormError } from '@/app/_lib/form-errors';
import { recipeCacheTags } from '@/app/_lib/recipe-cache';
import type { SavedDraftRef } from '@/application/drafts/saved-draft-dtos';
import type { RecipeImportRef } from '@/application/ingestion/recipe-import-dtos';
import type { RecipeRef } from '@/application/recipes/recipe-dtos';
import { formText, optionalFormText } from '@/components/forms/form-data';
import type { FormState } from '@/components/forms/form-state';
import { recipeContentFromForm } from '@/components/recipe-form/recipe-form-content';
import {
	recipeFormFieldNames,
	type SavedDraftResult,
} from '@/components/recipe-form/recipe-form-fields';
import {
	recipeFormSnapshotFromForm,
	recipeFormSnapshotImages,
	recipeFormSnapshotTitle,
} from '@/components/recipe-form/recipe-form-snapshot';
import { keptDraftPath, savedDraftPath } from '@/components/recipe-import/recipe-entry-paths';
import {
	recipeImportFieldNames,
	scanUploadsFromForm,
} from '@/components/recipe-import/recipe-import-forms';
import { addedRecipePath, contributePath } from '@/components/recipe/recipe-paths';
import {
	getRecipeImageService,
	getRecipeImportService,
	getRecipeService,
	getSavedDraftService,
} from '@/composition/services';

// The new slug's tag clears a cached miss for it, such as a visit before the recipe existed.
// Redirects to the saved recipe, so the editor sees it rendered fresh in this response; a
// navigation afterwards could get the CDN's copy from before the save for a few seconds. The
// recipe's page says once that it was added.
export async function createRecipe(_state: FormState, formData: FormData): Promise<FormState> {
	let recipe: RecipeRef;
	try {
		recipe = await getRecipeService().createRecipe({
			content: recipeContentFromForm(formText(formData, recipeFormFieldNames.recipe)),
			draftId: optionalFormText(formData, recipeFormFieldNames.draftId),
			draftVersion: optionalFormText(formData, recipeFormFieldNames.draftVersion),
		});
	} catch (error) {
		return toFormError(error);
	}

	getRecipeImageService().scheduleSweep();
	updateTag(recipeCacheTags.list);
	updateTag(recipeCacheTags.recipe(recipe.slug));
	redirect(addedRecipePath(recipe.slug));
}

// Saves whatever the form holds as the member's draft. The snapshot is checked here, where it
// arrives, and the service keeps it as it came, with the title and images read from it. Nothing
// cached changes, so there is no tag to update.
export async function saveDraft(
	_state: FormState<SavedDraftResult>,
	formData: FormData
): Promise<FormState<SavedDraftResult>> {
	let draft: SavedDraftRef;
	try {
		const snapshot = recipeFormSnapshotFromForm(formText(formData, recipeFormFieldNames.draft));
		draft = await getSavedDraftService().saveDraft({
			draftId: optionalFormText(formData, recipeFormFieldNames.draftId),
			draftVersion: optionalFormText(formData, recipeFormFieldNames.draftVersion),
			values: snapshot,
			title: recipeFormSnapshotTitle(snapshot),
			imagePathnames: recipeFormSnapshotImages(snapshot),
		});
	} catch (error) {
		return toFormError(error);
	}

	getRecipeImageService().scheduleSweep();
	return { status: 'success', draftId: draft.id, savedAt: draft.savedAt };
}

// Deletes the draft the form names, at the version the page shows, which a draft another page saved
// since no longer has.
async function deleteNamedDraft(formData: FormData): Promise<FormState> {
	try {
		await getSavedDraftService().deleteDraft(
			formText(formData, recipeFormFieldNames.draftId),
			optionalFormText(formData, recipeFormFieldNames.draftVersion)
		);
	} catch (error) {
		return toFormError(error);
	}

	getRecipeImageService().scheduleSweep();
	return { status: 'success' };
}

// Deletes a draft the start page lists. The page renders again, so the list and the header's count
// drop it.
export async function deleteDraft(_state: FormState, formData: FormData): Promise<FormState> {
	const result = await deleteNamedDraft(formData);
	if (result.status === 'success') {
		refresh();
	}
	return result;
}

// Deletes the draft open in the recipe form, as emptying the form or its page's menu does. Nothing
// renders again: the form is what the page shows, and the draft's page rendered anew would replace it.
export async function deleteOpenDraft(_state: FormState, formData: FormData): Promise<FormState> {
	return deleteNamedDraft(formData);
}

// Leads from a recipe form's page to the start page, which says there that the draft named is kept.
// The header counts the member's drafts in the layout, which a client navigation keeps, so it renders
// again with the page. A page whose draft was deleted takes no place in the history.
export async function returnToStart(
	keptDraftId: string | undefined,
	history: 'push' | 'replace'
): Promise<void> {
	refresh();
	redirect(
		typeof keptDraftId === 'string' ? keptDraftPath(keptDraftId) : contributePath,
		history === 'replace' ? 'replace' : 'push'
	);
}

// Opens the draft the import made. Nothing cached changes until it is saved as a recipe, so there is
// no tag to update, and the layout renders again with the draft's page for the header's count of
// drafts, which a redirect alone keeps as it was. The page sets how long the action may run.
export async function importFromUrl(_state: FormState, formData: FormData): Promise<FormState> {
	let recipeImport: RecipeImportRef;
	try {
		recipeImport = await getRecipeImportService().importFromUrl(
			formText(formData, recipeImportFieldNames.url)
		);
	} catch (error) {
		return toFormError(error);
	}

	getRecipeImageService().scheduleSweep();
	refresh();
	redirect(savedDraftPath(recipeImport.draftId));
}

// Opens the draft the import made, as importFromUrl does.
export async function importFromScans(_state: FormState, formData: FormData): Promise<FormState> {
	let recipeImport: RecipeImportRef;
	try {
		recipeImport = await getRecipeImportService().importFromScans(scanUploadsFromForm(formData));
	} catch (error) {
		return toFormError(error);
	}

	getRecipeImageService().scheduleSweep();
	refresh();
	redirect(savedDraftPath(recipeImport.draftId));
}
