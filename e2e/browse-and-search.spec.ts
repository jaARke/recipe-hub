import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import { recipeEntryPaths } from '@/components/recipe-import/recipe-entry-paths';
import { recipeListPath, recipePath, recipeSearchPath } from '@/components/recipe/recipe-paths';
import { slugify } from '@/domain/recipe/slug';
import { expect, test as base } from './support/fixtures';
import { expectHeaderSection } from './support/header-section';
import { waitForHydration } from './support/hydration';
import { deleteRecipeInEditor } from './support/recipe-editor';
import { testMemberName } from './support/test-members';

// Browse filters without words, in its sidebar from lg and behind its Filters button below it, and
// Search finds words within the filters they were typed under. Each test lists only the recipes its
// own member added, so develop's other recipes never show in what it lists.

type OwnRecipe = {
	title: string;
	ingredient: string;
	step: string;
	// As the recipe form labels each choice.
	chapter: string;
	holidays: string[];
	diets: string[];
};

type OwnRecipes = {
	// Cookies & Candy for Easter, vegetarian and gluten-free, and the only one with lemon in it.
	lemonBars: OwnRecipe;
	// Cookies & Candy for Christmas, vegetarian, and saved last, so Browse lists it first.
	shortbread: OwnRecipe;
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

const test = base.extend<{ ownRecipes: OwnRecipes }>({
	// Saved and deleted through the dev server, whose writes expire the cached lists Browse shows; the
	// member fixture deletes any left behind.
	ownRecipes: async ({ page, signIn }, use) => {
		const run = randomUUID().slice(0, 8);
		const lemonBars = {
			title: `End-to-end lemon bars ${run}`,
			ingredient: '3 lemons',
			step: 'Bake until set.',
			chapter: 'Cookies & Candy',
			holidays: ['Easter'],
			diets: ['Vegetarian', 'Gluten-free'],
		};
		const shortbread = {
			title: `End-to-end shortbread ${run}`,
			ingredient: '2 cups flour',
			step: 'Bake until golden.',
			chapter: 'Cookies & Candy',
			holidays: ['Christmas'],
			diets: ['Vegetarian'],
		};
		await signIn();
		for (const recipe of [lemonBars, shortbread]) {
			await saveRecipeByHand(page, recipe);
		}

		await use({ lemonBars, shortbread });

		for (const recipe of [lemonBars, shortbread]) {
			await deleteRecipeInEditor(page, recipe.title);
		}
	},
});

// From lg the filters sit in the sidebar; below it the toolbar's Filters button opens them.
async function openFilters(page: Page, isMobile: boolean) {
	if (isMobile) {
		const filters = page.getByRole('button', { name: /^Filters/ });
		await waitForHydration(filters);
		await filters.click();
	}
	await expect(page.getByRole('button', { name: 'Apply filters' })).toBeVisible();
}

// A holiday or diet, named with its count.
async function tick(page: Page, name: string) {
	const checkbox = page.getByRole('checkbox', { name, exact: true });
	await waitForHydration(checkbox);
	await checkbox.check();
}

// A chapter, named with its count.
async function chooseChapter(page: Page, name: string) {
	const chapter = page.getByRole('combobox', { name: 'Chapter' });
	await waitForHydration(chapter);
	await chapter.click();
	await page.getByRole('option', { name, exact: true }).click();
}

// The choices a group of checkboxes offers, each named with its count, in their order.
async function expectOffered(page: Page, group: string, names: string[]) {
	const checkboxes = page.getByRole('group', { name: group }).getByRole('checkbox');
	await expect(checkboxes).toHaveCount(names.length);
	for (const [index, name] of names.entries()) {
		await expect(checkboxes.nth(index)).toHaveAccessibleName(name);
	}
}

// The applied filters' chips, in order, each named for the filter it removes.
async function expectActiveFilters(page: Page, labels: string[]) {
	await expect(page.getByRole('list', { name: 'Active filters' }).getByRole('link')).toHaveText(
		labels.map((label) => `Remove ${label}`)
	);
}

// Browse's cards, newest first.
async function expectCards(page: Page, recipes: OwnRecipe[]) {
	await expect(
		page.getByRole('region', { name: 'Recipes' }).getByRole('heading', { level: 2 })
	).toHaveText(recipes.map(({ title }) => title));
}

// Search's rows, best match first.
async function expectRows(page: Page, recipes: OwnRecipe[]) {
	await expect(
		page.getByRole('region', { name: 'Results' }).getByRole('heading', { level: 3 })
	).toHaveText(recipes.map(({ title }) => title));
}

// From lg the header's field is in its row; below it the search icon opens the field across the row.
async function searchInHeader(page: Page, isMobile: boolean, words: string) {
	if (isMobile) {
		const openField = page.getByRole('button', { name: 'Search recipes' });
		await waitForHydration(openField);
		await openField.click();
	}
	const field = page.getByRole('searchbox', { name: 'Search recipes' });
	await waitForHydration(field);
	await field.fill(words);
	await field.press('Enter');
}

// Browse, filtered or not, is the section's own page.
const browseMarked = { section: 'Browse', ariaCurrent: 'page' } as const;

const addedByMember = `Added by ${testMemberName}`;

test('Browse filters by chapter, holiday, and diet, counting what each choice gives, and each chip takes its filter off', async ({
	page,
	isMobile,
	member,
	ownRecipes: { lemonBars, shortbread },
}) => {
	const byMember = `contributor=${member.id}`;
	await page.goto(`${recipeListPath}?${byMember}`);
	await expectActiveFilters(page, [addedByMember]);
	await expectCards(page, [shortbread, lemonBars]);

	await openFilters(page, isMobile);
	await expectOffered(page, 'Holidays', ['Easter 1', 'Christmas 1']);
	await expectOffered(page, 'Diet', ['Vegetarian 2', 'Gluten-free 1']);
	await tick(page, 'Easter 1');
	await tick(page, 'Christmas 1');
	await page.getByRole('button', { name: 'Apply filters' }).click();
	await expect(page).toHaveURL(`${recipeListPath}?holiday=easter&holiday=christmas&${byMember}`);
	if (isMobile) {
		// Applying closes the filters and moves focus to the cards' heading.
		await expect(page.getByRole('group', { name: 'Holidays' })).toBeHidden();
		await expect(page.getByRole('heading', { name: 'Recipes', level: 1 })).toBeFocused();
	}
	// A recipe for any holiday chosen.
	await expectActiveFilters(page, ['Easter', 'Christmas', addedByMember]);
	await expectCards(page, [shortbread, lemonBars]);
	await expectHeaderSection(page, isMobile, browseMarked);

	await openFilters(page, isMobile);
	await chooseChapter(page, 'Cookies & Candy 2');
	await tick(page, 'Gluten-free 1');
	await page.getByRole('button', { name: 'Apply filters' }).click();
	await expect(page).toHaveURL(
		`${recipeListPath}?chapter=cookies-candy&holiday=easter&holiday=christmas&diet=gluten-free&${byMember}`
	);
	await expectActiveFilters(page, [
		'Cookies & Candy',
		'Easter',
		'Christmas',
		'Gluten-free',
		addedByMember,
	]);
	await expectCards(page, [lemonBars]);

	// Holidays count with every filter but their own, so the shortbread's Christmas falls to zero once
	// Gluten-free leaves it out, and stays on offer while chosen; diets count within the cards.
	await openFilters(page, isMobile);
	await expectOffered(page, 'Holidays', ['Easter 1', 'Christmas 0']);
	await expectOffered(page, 'Diet', ['Vegetarian 1', 'Gluten-free 1']);

	await page.getByRole('link', { name: 'Remove Gluten-free' }).click();
	await expect(page).toHaveURL(
		`${recipeListPath}?chapter=cookies-candy&holiday=easter&holiday=christmas&${byMember}`
	);
	await expectActiveFilters(page, ['Cookies & Candy', 'Easter', 'Christmas', addedByMember]);
	await expectCards(page, [shortbread, lemonBars]);

	await page.getByRole('link', { name: 'Clear filters' }).click();
	await expect(page).toHaveURL(recipeListPath);
	await expect(page.getByRole('list', { name: 'Active filters' })).toBeHidden();
	await expectHeaderSection(page, isMobile, browseMarked);
});

test('a search typed in the header on a filtered Browse keeps its filters, and Clear search returns to them', async ({
	page,
	isMobile,
	member,
	ownRecipes: { lemonBars, shortbread },
}) => {
	const filters = `chapter=cookies-candy&contributor=${member.id}`;
	await page.goto(`${recipeListPath}?${filters}`);
	await searchInHeader(page, isMobile, 'lemon');
	await expect(page).toHaveURL(`${recipeSearchPath}?q=lemon&${filters}`);
	await expectActiveFilters(page, ['“lemon”', 'Cookies & Candy', addedByMember]);
	await expectRows(page, [lemonBars]);
	// The field holding the words marks Search, and on a phone takes the header's row until Cancel.
	if (isMobile) {
		await page.getByRole('button', { name: 'Cancel' }).click();
	}
	await expectHeaderSection(page, isMobile, undefined);

	if (isMobile) {
		await page.getByRole('button', { name: 'Search recipes' }).click();
	}
	await expect(page.getByRole('searchbox', { name: 'Search recipes' })).toHaveValue('lemon');
	await page.getByRole('button', { name: 'Clear search' }).click();
	await expect(page).toHaveURL(`${recipeListPath}?${filters}`);
	await expectActiveFilters(page, ['Cookies & Candy', addedByMember]);
	await expectCards(page, [shortbread, lemonBars]);
	await expectHeaderSection(page, isMobile, browseMarked);
});

test('a recipe opened from a search marks no section and leads back to the search', async ({
	page,
	isMobile,
	member,
	ownRecipes: { lemonBars },
}) => {
	const search = `${recipeSearchPath}?q=lemon&contributor=${member.id}`;
	await page.goto(search);
	const row = page
		.getByRole('region', { name: 'Results' })
		.getByRole('link', { name: lemonBars.title });
	await waitForHydration(row);
	await row.click();
	await expect(page).toHaveURL(recipePath(slugify(lemonBars.title)));
	await expectHeaderSection(page, isMobile, undefined);

	const backLink = page.getByRole('link', { name: 'Back to search results' });
	await waitForHydration(backLink);
	await backLink.click();
	await expect(page).toHaveURL(search);
	await expectRows(page, [lemonBars]);
});
