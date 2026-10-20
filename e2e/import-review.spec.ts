import { randomUUID } from 'node:crypto';
import type { WebPage } from '@/application/ports/web-page-fetcher';
import { savedDraftPath } from '@/components/recipe-import/recipe-entry-paths';
import { recipeImportPath } from '@/components/recipe-import/recipe-import-paths';
import { contributePath, recipePath } from '@/components/recipe/recipe-paths';
import { slugify } from '@/domain/recipe/slug';
import { expect, test } from './support/fixtures';
import { deleteRecipeInEditor } from './support/recipe-editor';
import { seedJsonLdImportDraft, seedLinkImportDraft } from './support/test-imports';
import { testMemberName } from './support/test-members';

// A page whose JSON-LD holds a whole recipe, with the fields that file it.
function recipePage(slug: string, filing: object): WebPage {
	const recipe = {
		'@context': 'https://schema.org',
		'@type': 'Recipe',
		name: 'Gingerbread',
		recipeIngredient: ['3 cups flour', '1 cup molasses'],
		recipeInstructions: [{ '@type': 'HowToStep', text: 'Mix and bake.' }],
		...filing,
	};
	return {
		url: `https://example.com/${slug}`,
		html: `<!doctype html><html><head><script type="application/ld+json">${JSON.stringify(recipe)}</script></head></html>`,
	};
}

// A member reviews a link import's draft, edits it, and saves it as a recipe, then deletes the
// recipe. The draft is seeded as the import service stores one after reading the page, so the run
// spends no AI credit; saving deletes the draft, and the member fixture deletes the import's record.
test('an import’s draft is reviewed, edited, and saved as a recipe', async ({
	page,
	develop,
	member,
	signIn,
}) => {
	// Each run's own title, so runs in parallel never share a slug.
	const title = `End-to-end lemonade ${randomUUID().slice(0, 8)}`;
	const reviewNote = 'The original’s amount of water is smudged.';
	const { importId, draftId } = await seedLinkImportDraft(develop.db, member, {
		sourceUrl: 'https://example.com/lemonade',
		recipe: {
			title: 'Lemonade',
			source: 'Aunt May',
			yield: { kind: 'servings', amount: '4' },
			times: { prepMinutes: 10 },
			ingredientSections: [{ lines: ['4 lemons', '1/2 cup sugar', '4 cups cold water'] }],
			instructionSections: [{ steps: ['Squeeze the lemons.', 'Stir in the sugar and water.'] }],
			chapter: 'appetizers-beverages',
			holidays: [],
			diets: [],
			reviewNotes: [{ field: 'step', section: 0, line: 1, note: reviewNote }],
		},
	});
	await signIn();

	// The import's earlier address leads to its draft.
	await page.goto(recipeImportPath(importId));
	await expect(page).toHaveURL(savedDraftPath(draftId));
	await expect(page.getByRole('heading', { name: 'Lemonade', level: 1 })).toBeVisible();
	await expect(page.getByText('Imported from')).toContainText('example.com');
	await expect(page.getByRole('textbox', { name: 'Title' })).toHaveValue('Lemonade');
	await expect(page.getByText(reviewNote)).toBeVisible();
	const chapter = page.getByRole('group', { name: 'Chapter' });
	await expect(chapter.getByRole('radio', { name: 'Appetizers & Beverages' })).toBeChecked();
	await expect(chapter.getByText('Check the chapter. It was chosen for you.')).toBeVisible();
	// The notes' intro takes focus once the form has hydrated, after which a fix clears its note.
	await expect(page.locator(':focus')).toContainText('2 things need a second look');

	await page.getByRole('textbox', { name: 'Title' }).fill(title);
	// Fixing what a note is about clears it, as Looks right does.
	await page.getByRole('textbox', { name: 'Step 2' }).fill('Stir in the sugar and the water.');
	await expect(page.getByText(reviewNote)).toBeHidden();
	await page.getByRole('button', { name: 'Looks right: Chapter' }).click();
	await expect(page.getByText('Check the chapter. It was chosen for you.')).toBeHidden();
	// The notes' intro stays to say so, and the last Looks right brings it into view.
	await expect(page.locator(':focus')).toContainText('Everything’s checked');
	await expect(page.locator(':focus')).toBeInViewport();
	await page.getByRole('button', { name: 'Add to cookbook' }).click();

	await expect(page).toHaveURL(recipePath(slugify(title)));
	await expect(page.getByRole('dialog', { name: 'Added to the cookbook' })).toBeVisible();
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

	// Saving deleted the draft, so the import's address leads to the start page.
	await page.goto(recipeImportPath(importId));
	await expect(page).toHaveURL(contributePath);

	await deleteRecipeInEditor(page, title);
});

// Each draft is seeded from a page's JSON-LD by the reader the import service uses, so its filing comes
// from the page's category, keywords, and diets, as a real import's does.
test('a page’s JSON-LD files its import for review, or leaves the chapter to the member', async ({
	page,
	develop,
	member,
	signIn,
}) => {
	const filed = await seedJsonLdImportDraft(
		develop.db,
		member,
		recipePage('gingerbread', {
			recipeCategory: 'Dessert',
			keywords: 'Christmas cookies, molasses',
			suitableForDiet: 'https://schema.org/VegetarianDiet',
		})
	);
	const unfiled = await seedJsonLdImportDraft(
		develop.db,
		member,
		recipePage('holiday-gingerbread', { recipeCategory: 'Holiday' })
	);
	await signIn();

	await page.goto(savedDraftPath(filed.draftId));
	const chapter = page.getByRole('group', { name: 'Chapter' });
	await expect(chapter.getByRole('radio', { name: 'Desserts' })).toBeChecked();
	await expect(chapter.getByText('Check the chapter. It was chosen for you.')).toBeVisible();
	const holidays = page.getByRole('group', { name: 'Holidays (optional)' });
	await expect(holidays.getByRole('checkbox', { name: 'Christmas' })).toBeChecked();
	await expect(
		holidays.getByText('Check the holidays. The original mentions Christmas.')
	).toBeVisible();
	const diet = page.getByRole('group', { name: 'Diet (optional)' });
	await expect(diet.getByRole('checkbox', { name: 'Vegetarian' })).toBeChecked();
	await expect(
		diet.getByText('Check the diet. Keep vegetarian only if the original says so.')
	).toBeVisible();
	await expect(page.locator(':focus')).toContainText('3 things need a second look');

	await page.goto(savedDraftPath(unfiled.draftId));
	await expect(page.locator(':focus')).toContainText('1 thing needs a second look');
	await expect(chapter.getByText('Choose a chapter.')).toBeVisible();
	await expect(chapter.getByRole('radio', { checked: true })).toHaveCount(0);
});
