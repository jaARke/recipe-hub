import { randomUUID } from 'node:crypto';
import { recipeImportPath } from '@/components/recipe-import/recipe-import-paths';
import { recipeEditPath, recipeListPath, recipePath } from '@/components/recipe/recipe-paths';
import { slugify } from '@/domain/recipe/slug';
import { expect, test } from './support/fixtures';
import { waitForHydration } from './support/hydration';
import { seedLinkImportDraft } from './support/test-imports';
import { testMemberName } from './support/test-members';

// A member reviews a link import's draft, edits it, and saves it as a recipe, then deletes the
// recipe. The draft is seeded as the import service stores one after reading the page, so the run
// spends no AI credit; saving clears the draft, and the member fixture deletes the import's record.
test('an import’s draft is reviewed, edited, and saved as a recipe', async ({
	page,
	develop,
	member,
	signIn,
}) => {
	// Each run's own title, so runs in parallel never share a slug.
	const title = `End-to-end lemonade ${randomUUID().slice(0, 8)}`;
	const reviewNote = 'The original’s amount of water is smudged.';
	const recipeImport = await seedLinkImportDraft(develop.db, member, {
		sourceUrl: 'https://example.com/lemonade',
		recipe: {
			title: 'Lemonade',
			source: 'Aunt May',
			yield: { kind: 'servings', amount: '4' },
			times: { prepMinutes: 10 },
			ingredientSections: [{ lines: ['4 lemons', '1/2 cup sugar', '4 cups cold water'] }],
			instructionSections: [{ steps: ['Squeeze the lemons.', 'Stir in the sugar and water.'] }],
			reviewNotes: [{ field: 'step', section: 0, line: 1, note: reviewNote }],
		},
	});
	await signIn();

	await page.goto(recipeImportPath(recipeImport.id));
	await expect(page.getByRole('heading', { name: 'Review the import', level: 1 })).toBeVisible();
	await expect(page.getByText('Imported from')).toContainText('example.com');
	await expect(page.getByRole('textbox', { name: 'Title' })).toHaveValue('Lemonade');
	await expect(page.getByText(reviewNote)).toBeVisible();
	// The notes' intro takes focus once the form has hydrated, after which a fix clears its note.
	await expect(page.locator(':focus')).toContainText('1 thing needs a second look');

	await page.getByRole('textbox', { name: 'Title' }).fill(title);
	// Fixing what a note is about clears it, as Looks right would.
	await page.getByRole('textbox', { name: 'Step 2' }).fill('Stir in the sugar and the water.');
	await expect(page.getByText(reviewNote)).toBeHidden();
	await page.getByRole('button', { name: 'Save recipe' }).click();

	await expect(page).toHaveURL(recipePath(slugify(title)));
	const recipe = page.getByRole('article', { name: title });
	await expect(recipe.getByRole('heading', { name: title, level: 1 })).toBeVisible();
	await expect(recipe.getByText('From Aunt May (example.com)')).toBeVisible();
	await expect(recipe.getByRole('listitem')).toContainText([
		'4 lemons',
		'½ cup sugar',
		'4 cups cold water',
		'Squeeze the lemons.',
		'Stir in the sugar and the water.',
	]);
	await expect(recipe.getByRole('definition').filter({ hasText: testMemberName })).toBeVisible();

	// A saved import's review leads to its recipe for good.
	await page.goto(recipeImportPath(recipeImport.id));
	await expect(page).toHaveURL(recipePath(slugify(title)));

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

	// Saving cleared the draft, so with the recipe gone the review has nothing left to show.
	await page.goto(recipeImportPath(recipeImport.id));
	await expect(page.getByText('This draft isn’t available')).toBeVisible();
});
