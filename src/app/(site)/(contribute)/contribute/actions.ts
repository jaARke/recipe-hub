'use server';

import { updateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { toFormError } from '@/app/_lib/form-errors';
import { recipeCacheTags } from '@/app/_lib/recipe-cache';
import type { RecipeImportRef } from '@/application/ingestion/recipe-import-dtos';
import type { RecipeRef } from '@/application/recipes/recipe-dtos';
import { formText, optionalFormText } from '@/components/forms/form-data';
import type { FormState } from '@/components/forms/form-state';
import { recipeContentFromForm } from '@/components/recipe-form/recipe-form-content';
import { recipeFormFieldNames } from '@/components/recipe-form/recipe-form-fields';
import {
	recipeImportFieldNames,
	scanPathnamesFromForm,
} from '@/components/recipe-import/recipe-import-forms';
import { recipeImportPath } from '@/components/recipe-import/recipe-import-paths';
import { recipePath } from '@/components/recipe/recipe-paths';
import {
	getRecipeImageService,
	getRecipeImportService,
	getRecipeService,
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
		});
	} catch (error) {
		return toFormError(error);
	}

	getRecipeImageService().scheduleSweep();
	updateTag(recipeCacheTags.list);
	updateTag(recipeCacheTags.recipe(recipe.slug));
	redirect(recipePath(recipe.slug));
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
		recipeImport = await getRecipeImportService().importFromScans(scanPathnamesFromForm(formData));
	} catch (error) {
		return toFormError(error);
	}

	getRecipeImageService().scheduleSweep();
	redirect(recipeImportPath(recipeImport.id));
}
