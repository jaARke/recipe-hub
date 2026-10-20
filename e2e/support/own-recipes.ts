import { expect, type Page } from '@playwright/test';
import { recipeEntryPaths } from '@/components/recipe-import/recipe-entry-paths';
import { recipePath } from '@/components/recipe/recipe-paths';
import { slugify } from '@/domain/recipe/slug';
import { deleteRecipeInEditor } from './recipe-editor';

// A recipe a test adds as its member, which the Recipes page lists filtered by the member's id, so
// develop's other recipes never show in what a test counts or lists.
export type OwnRecipe = {
	// With the run's id, so runs in parallel never share a slug.
	title: string;
	ingredient: string;
	step: string;
	// As the recipe form labels each choice.
	chapter: string;
	holidays: string[];
	diets: string[];
};

// Saved through manual entry, filed as a member files it.
async function saveRecipeByHand(page: Page, recipe: OwnRecipe) {
	await page.goto(recipeEntryPaths.manual);
	// Add to cookbook is disabled until the form hydrates.
	await expect(page.getByRole('button', { name: 'Add to cookbook' })).toBeEnabled();
	const form = page.getByRole('main');
	await form.getByRole('textbox', { name: 'Title' }).fill(recipe.title);
	await form.getByRole('textbox', { name: 'Ingredient 1' }).fill(recipe.ingredient);
	await form.getByRole('textbox', { name: 'Step 1' }).fill(recipe.step);
	await form.getByRole('radio', { name: recipe.chapter }).check();
	for (const choice of [...recipe.holidays, ...recipe.diets]) {
		await form.getByRole('checkbox', { name: choice }).check();
	}
	await page.getByRole('button', { name: 'Add to cookbook' }).click();
	await expect(page).toHaveURL(recipePath(slugify(recipe.title)));
}

// Adds the recipes as the signed-in member, in their order, runs the test with them, then deletes
// them. Both go through the dev server, whose writes expire the cached lists the Recipes page shows;
// the member fixture deletes any a failed test leaves.
export async function withOwnRecipes<Recipes extends Record<string, OwnRecipe>>(
	page: Page,
	recipes: Recipes,
	run: (recipes: Recipes) => Promise<void>
): Promise<void> {
	for (const recipe of Object.values(recipes)) {
		await saveRecipeByHand(page, recipe);
	}

	await run(recipes);

	for (const recipe of Object.values(recipes)) {
		await deleteRecipeInEditor(page, recipe.title);
	}
}
