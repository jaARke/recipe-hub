import { randomUUID } from 'node:crypto';
import { contributePath, recipeEditPath, recipePath } from '@/components/recipe/recipe-paths';
import { slugify } from '@/domain/recipe/slug';
import { expect, test } from './support/fixtures';
import { draftStatus, openTypeItIn, savedDraftAddress, yourDrafts } from './support/recipe-drafts';
import { deleteRecipeInEditor } from './support/recipe-editor';
import { testMemberName } from './support/test-members';

// A member types a recipe in from the start page, which keeps it as a draft until it is added, then
// edits and deletes it, so the run leaves no recipe or draft behind; the member fixture deletes any
// a failed run leaves.
test('a recipe typed in is kept as a draft, added, edited, and deleted', async ({
	page,
	signIn,
}) => {
	// Each run's own title, so runs in parallel never share a slug.
	const run = randomUUID().slice(0, 8);
	const title = `End-to-end soup ${run}`;
	const editedTitle = `End-to-end stew ${run}`;
	await signIn();

	await page.goto(contributePath);
	await openTypeItIn(page);
	const form = page.getByRole('main');
	await form.getByRole('textbox', { name: 'Title' }).fill(title);
	// The form saves itself as a draft, whose title then heads the page and whose address it takes.
	await expect(draftStatus(page, 'Saving draft')).toBeVisible();
	await expect(draftStatus(page, 'Draft saved')).toBeVisible();
	await expect(page).toHaveURL(savedDraftAddress);
	await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible();
	await form.getByRole('textbox', { name: 'Ingredient 1' }).fill('2 cups water');
	await form.getByRole('button', { name: 'Add ingredient' }).click();
	await form.getByRole('textbox', { name: 'Ingredient 2' }).fill('1 teaspoon salt');
	await form.getByRole('textbox', { name: 'Step 1' }).fill('Bring the water to a boil.');
	await form.getByRole('textbox', { name: 'Servings' }).fill('4');
	await form.getByRole('radio', { name: 'Soups & Salads' }).check();
	await form.getByRole('checkbox', { name: 'Vegan' }).check();
	await page.getByRole('button', { name: 'Add to cookbook' }).click();

	// Adding says so once: the address becomes the recipe's own, so a reload says nothing.
	await expect(page).toHaveURL(recipePath(slugify(title)));
	await expect(page.getByRole('dialog', { name: 'Added to the cookbook' })).toBeVisible();
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
	await expect(page.getByRole('heading', { name: 'Page Not Found' })).toBeVisible();

	// Adding the recipe deleted its draft.
	await page.goto(contributePath);
	await expect(yourDrafts(page)).toContainText('No drafts.');
});
