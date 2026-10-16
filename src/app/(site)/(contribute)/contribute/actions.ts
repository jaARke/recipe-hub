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
import {
	recipeImportFieldNames,
	scanUploadsFromForm,
} from '@/components/recipe-import/recipe-import-forms';
import { recipeImportPath } from '@/components/recipe-import/recipe-import-paths';
import { recipePath } from '@/components/recipe/recipe-paths';
import {
	getRecipeImageService,
	getRecipeImportService,
	getRecipeService,
	getSavedDraftService,
} from '@/composition/services';

// The new slug's tag clears a cached miss for it, such as a visit before the recipe existed.
// Redirects to the saved recipe, so the editor sees it rendered fresh in this response; a
// navigation afterwards could get the CDN's copy from before the save for a few seconds.
export async function createRecipe(_state: FormState, formData: FormData): Promise<FormState> {
	let recipe: RecipeRef;
	try {
		recipe = await getRecipeService().createRecipe({
			content: recipeContentFromForm(formText(formData, recipeFormFieldNames.recipe)),
			importId: optionalFormText(formData, recipeFormFieldNames.importId),
			draftId: optionalFormText(formData, recipeFormFieldNames.draftId),
		});
	} catch (error) {
		return toFormError(error);
	}

	getRecipeImageService().scheduleSweep();
	updateTag(recipeCacheTags.list);
	updateTag(recipeCacheTags.recipe(recipe.slug));
	redirect(recipePath(recipe.slug));
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
			importId: optionalFormText(formData, recipeFormFieldNames.importId),
			values: snapshot,
			title: recipeFormSnapshotTitle(snapshot),
			imagePathnames: recipeFormSnapshotImages(snapshot),
		});
	} catch (error) {
		return toFormError(error);
	}

	getRecipeImageService().scheduleSweep();
	return {
		status: 'success',
		draftId: draft.id,
		savedAt: draft.savedAt,
		expiresAt: draft.expiresAt,
	};
}

// Deletes a saved draft, or an import's draft awaiting review, whichever the form names. The page
// renders again, so the Drafts tab drops it.
export async function deleteDraft(_state: FormState, formData: FormData): Promise<FormState> {
	const draftId = optionalFormText(formData, recipeFormFieldNames.draftId);
	try {
		await (draftId === undefined
			? getSavedDraftService().deleteImportDraft(formText(formData, recipeFormFieldNames.importId))
			: getSavedDraftService().deleteDraft(draftId));
	} catch (error) {
		return toFormError(error);
	}

	getRecipeImageService().scheduleSweep();
	refresh();
	return { status: 'success' };
}

// Opens the draft for review. Nothing cached changes until it is saved as a recipe, so there is no
// tag to update. The page sets how long the action may run.
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
	redirect(recipeImportPath(recipeImport.id));
}

// Opens the draft for review, as importFromUrl does.
export async function importFromScans(_state: FormState, formData: FormData): Promise<FormState> {
	let recipeImport: RecipeImportRef;
	try {
		recipeImport = await getRecipeImportService().importFromScans(scanUploadsFromForm(formData));
	} catch (error) {
		return toFormError(error);
	}

	getRecipeImageService().scheduleSweep();
	redirect(recipeImportPath(recipeImport.id));
}
