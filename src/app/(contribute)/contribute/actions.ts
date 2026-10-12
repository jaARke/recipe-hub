'use server';

import { updateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { toFormError } from '@/app/_lib/form-errors';
import { recipeCacheTags } from '@/app/_lib/recipe-cache';
import type { RecipeRef } from '@/application/recipes/recipe-dtos';
import { formText } from '@/components/forms/form-data';
import type { FormState } from '@/components/forms/form-state';
import { recipeContentFromForm } from '@/components/recipe-form/recipe-form-content';
import { recipeFormFieldNames } from '@/components/recipe-form/recipe-form-fields';
import { recipePath } from '@/components/recipe/recipe-paths';
import { getRecipeService } from '@/composition/services';

// The new slug's tag clears a cached miss for it, such as a visit before the recipe existed.
// Redirects to the saved recipe, so the editor sees it rendered fresh in this response; a
// navigation afterwards could get the CDN's copy from before the save for a few seconds.
export async function createRecipe(_state: FormState, formData: FormData): Promise<FormState> {
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
	redirect(recipePath(recipe.slug));
}
