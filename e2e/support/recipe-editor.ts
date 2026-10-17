import { expect, type Page } from '@playwright/test';
import { recipeEditPath, recipeListPath } from '@/components/recipe/recipe-paths';
import { slugify } from '@/domain/recipe/slug';
import { waitForHydration } from './hydration';

// Deletes the recipe with the title from its editor, as its contributor would, which lands on
// Browse. The dev server's delete expires the cached lists, which deleteTestMember's cannot reach.
export async function deleteRecipeInEditor(page: Page, title: string) {
	await page.goto(recipeEditPath(slugify(title)));
	const recipeActions = page.getByRole('button', { name: 'Recipe actions' });
	await waitForHydration(recipeActions);
	await recipeActions.click();
	await page.getByRole('menuitem', { name: 'Delete recipe' }).click();
	await page
		.getByRole('alertdialog', { name: `Delete “${title}”?` })
		.getByRole('button', { name: 'Delete recipe' })
		.click();
	await expect(page).toHaveURL(recipeListPath);
}
