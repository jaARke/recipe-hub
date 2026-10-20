import { randomUUID } from 'node:crypto';
import { contributePath, recipeEditPath, recipePath } from '@/components/recipe/recipe-paths';
import { slugify } from '@/domain/recipe/slug';
import { expect, test } from './support/fixtures';
import { deleteRecipeInEditor } from './support/recipe-editor';
import { testMemberName } from './support/test-members';

// A member enters a recipe by hand, edits it, and deletes it, so the run leaves no recipe behind; the
// member fixture deletes any a failed run leaves.
test('a recipe entered by hand is saved, edited, and deleted', async ({ page, signIn }) => {
	// Each run's own title, so runs in parallel never share a slug.
	const run = randomUUID().slice(0, 8);
	const title = `End-to-end soup ${run}`;
	const editedTitle = `End-to-end stew ${run}`;
	await signIn();

	await page.goto(contributePath);
	// Save is disabled until the form hydrates, before which Add ingredient adds nothing.
	await expect(page.getByRole('button', { name: 'Save recipe' })).toBeEnabled();
	const form = page.getByRole('tabpanel', { name: 'Manual' });
	await form.getByRole('textbox', { name: 'Title' }).fill(title);
	await form.getByRole('textbox', { name: 'Ingredient 1' }).fill('2 cups water');
	await form.getByRole('button', { name: 'Add ingredient' }).click();
	await form.getByRole('textbox', { name: 'Ingredient 2' }).fill('1 teaspoon salt');
	await form.getByRole('textbox', { name: 'Step 1' }).fill('Bring the water to a boil.');
	await form.getByRole('textbox', { name: 'Servings' }).fill('4');
	await form.getByRole('radio', { name: 'Soups & Salads' }).check();
	await form.getByRole('checkbox', { name: 'Vegan' }).check();
	await page.getByRole('button', { name: 'Save recipe' }).click();

	await expect(page).toHaveURL(recipePath(slugify(title)));
	const recipe = page.getByRole('article', { name: title });
	await expect(recipe.getByRole('heading', { name: title, level: 1 })).toBeVisible();
	await expect(recipe.getByRole('listitem')).toContainText([
		'2 cups water',
		'1 teaspoon salt',
		'Bring the water to a boil.',
	]);
	await expect(recipe.getByRole('term').filter({ hasText: 'Serves' })).toBeVisible();
	await expect(recipe.getByRole('definition').filter({ hasText: testMemberName })).toBeVisible();

	await recipe.getByRole('link', { name: 'Edit recipe' }).click();
	await expect(page).toHaveURL(recipeEditPath(slugify(title)));
	await expect(page.getByRole('button', { name: 'Save changes' })).toBeEnabled();
	// The recipe keeps its chapter and diets, with what Vegan implies.
	await expect(page.getByRole('radio', { name: 'Soups & Salads' })).toBeChecked();
	for (const diet of ['Vegan', 'Vegetarian', 'Dairy-free']) {
		await expect(page.getByRole('checkbox', { name: diet })).toBeChecked();
	}
	await page.getByRole('textbox', { name: 'Title' }).fill(editedTitle);
	await page.getByRole('button', { name: 'Add step' }).click();
	await page.getByRole('textbox', { name: 'Step 2' }).fill('Stir in the salt.');
	await page.getByRole('button', { name: 'Save changes' }).click();

	// The slug follows the title, and the old one still finds the recipe.
	await expect(page).toHaveURL(recipePath(slugify(editedTitle)));
	const edited = page.getByRole('article', { name: editedTitle });
	await expect(edited.getByRole('listitem')).toContainText([
		'Bring the water to a boil.',
		'Stir in the salt.',
	]);
	await page.goto(recipePath(slugify(title)));
	await expect(page).toHaveURL(recipePath(slugify(editedTitle)));

	await deleteRecipeInEditor(page, editedTitle);
	await expect(page.getByRole('link', { name: editedTitle })).toBeHidden();

	await page.goto(recipePath(slugify(editedTitle)));
	await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});
