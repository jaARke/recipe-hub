'use server';

import { updateTag } from 'next/cache';
import { toFormError } from '@/app/_lib/form-errors';
import { recipeCacheTags } from '@/app/_lib/recipe-cache';
import type { RecipeRef, UpdatedRecipeRef } from '@/application/recipes/recipe-dtos';
import { formText } from '@/components/forms/form-data';
import type { FormState } from '@/components/forms/form-state';
import { recipeContentFromForm } from '@/components/recipe-form/recipe-form-content';
import {
	recipeFormFieldNames,
	type SavedRecipe,
} from '@/components/recipe-form/recipe-form-fields';
import { getRecipeService } from '@/composition/services';

export async function updateRecipe(
	_state: FormState<SavedRecipe>,
	formData: FormData
): Promise<FormState<SavedRecipe>> {
	let recipe: UpdatedRecipeRef;
	try {
		recipe = await getRecipeService().updateRecipe(
			formText(formData, recipeFormFieldNames.recipeId),
			recipeContentFromForm(formText(formData, recipeFormFieldNames.recipe)),
			formText(formData, recipeFormFieldNames.recipeVersion)
		);
	} catch (error) {
		return toFormError(error);
	}

	updateTag(recipeCacheTags.list);
	updateTag(recipeCacheTags.recipe(recipe.slug));
	if (recipe.previousSlug !== undefined) {
		updateTag(recipeCacheTags.recipe(recipe.previousSlug));
	}
	return { status: 'success', slug: recipe.slug };
}

// Its re-render of the edit page finds no recipe, but React commits that together with the dialog's
// navigation to the list, so the not-found page never shows.
export async function deleteRecipe(_state: FormState, formData: FormData): Promise<FormState> {
	let recipe: RecipeRef;
	try {
		recipe = await getRecipeService().deleteRecipe(
			formText(formData, recipeFormFieldNames.recipeId)
		);
	} catch (error) {
		return toFormError(error);
	}

	updateTag(recipeCacheTags.list);
	updateTag(recipeCacheTags.recipe(recipe.slug));
	return { status: 'success' };
}
