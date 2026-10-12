'use server';

import { updateTag } from 'next/cache';
import { toFormError } from '@/app/_lib/form-errors';
import { recipeCacheTags } from '@/app/_lib/recipe-cache';
import type { RecipeRef } from '@/application/recipes/recipe-dtos';
import { formText } from '@/components/forms/form-data';
import type { FormState } from '@/components/forms/form-state';
import { recipeContentFromForm } from '@/components/recipe-form/recipe-form-content';
import {
	recipeFormFieldNames,
	type SavedRecipe,
} from '@/components/recipe-form/recipe-form-fields';
import { getRecipeService } from '@/composition/services';

// The new slug's tag clears a cached miss for it, such as a visit before the recipe existed.
export async function createRecipe(
	_state: FormState<SavedRecipe>,
	formData: FormData
): Promise<FormState<SavedRecipe>> {
	let recipe: RecipeRef;
	try {
		recipe = await getRecipeService().createRecipe({
			content: recipeContentFromForm(formText(formData, recipeFormFieldNames.recipe)),
			provenance: { entryMode: 'manual' },
		});
	} catch (error) {
		return toFormError(error);
	}

	updateTag(recipeCacheTags.list);
	updateTag(recipeCacheTags.recipe(recipe.slug));
	return { status: 'success', slug: recipe.slug };
}
