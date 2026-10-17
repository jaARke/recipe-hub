import { randomUUID } from 'node:crypto';
import type { Locator, Page } from '@playwright/test';
import {
	contributePath,
	recipeListPath,
	recipePath,
	recipeSearchPath,
} from '@/components/recipe/recipe-paths';
import { slugify } from '@/domain/recipe/slug';
import { expect, test as base } from './support/fixtures';
import { expectHeaderSection } from './support/header-section';
import { waitForHydration } from './support/hydration';
import { deleteRecipeInEditor } from './support/recipe-editor';

// Browse filters without words, in its sidebar from lg and behind its Filters button below it, and
// Search finds words within the filters they were typed under. Each test filters by tags only its own
// recipes carry, so develop's other recipes never show in what it lists.

type OwnTag = {
	label: string;
	// As a URL's query writes it.
	inQuery: string;
};

type OwnRecipe = {
	title: string;
	ingredient: string;
	step: string;
	tags: OwnTag[];
};

type OwnRecipes = {
	tags: { dessert: OwnTag; makeAhead: OwnTag; baking: OwnTag };
	// Dessert, Make ahead, and Baking, and the only one with lemon in it.
	lemonBars: OwnRecipe;
	// Dessert and Baking, saved last, so Browse lists it first.
	shortbread: OwnRecipe;
};

// Saved through manual entry, with the tags typed and not added, which the form saves with the
// recipe.
async function saveRecipeByHand(page: Page, recipe: OwnRecipe) {
	await page.goto(contributePath);
	// Save is disabled until the form hydrates.
	await expect(page.getByRole('button', { name: 'Save recipe' })).toBeEnabled();
	const form = page.getByRole('tabpanel', { name: 'Manual' });
	await form.getByRole('textbox', { name: 'Title' }).fill(recipe.title);
	await form.getByRole('textbox', { name: 'Ingredient 1' }).fill(recipe.ingredient);
	await form.getByRole('textbox', { name: 'Step 1' }).fill(recipe.step);
	const tags = form.getByRole('combobox', { name: 'Tags' });
	await tags.fill(recipe.tags.map(({ label }) => label).join(', '));
	// The open list hides the rest of the page from the accessibility tree; Tab closes it.
	await tags.press('Tab');
	await page.getByRole('button', { name: 'Save recipe' }).click();
	await expect(page).toHaveURL(recipePath(slugify(recipe.title)));
}

const test = base.extend<{ ownRecipes: OwnRecipes }>({
	// Saved and deleted through the dev server, whose writes expire the cached lists Browse shows; the
	// member fixture deletes any left behind.
	ownRecipes: async ({ page, signIn }, use) => {
		const run = randomUUID().slice(0, 8);
		const tags = {
			dessert: { label: `Dessert ${run}`, inQuery: `Dessert+${run}` },
			makeAhead: { label: `Make ahead ${run}`, inQuery: `Make+ahead+${run}` },
			baking: { label: `Baking ${run}`, inQuery: `Baking+${run}` },
		};
		const lemonBars = {
			title: `End-to-end lemon bars ${run}`,
			ingredient: '3 lemons',
			step: 'Bake until set.',
			tags: [tags.dessert, tags.makeAhead, tags.baking],
		};
		const shortbread = {
			title: `End-to-end shortbread ${run}`,
			ingredient: '2 cups flour',
			step: 'Bake until golden.',
			tags: [tags.dessert, tags.baking],
		};
		await signIn();
		for (const recipe of [lemonBars, shortbread]) {
			await saveRecipeByHand(page, recipe);
		}

		await use({ tags, lemonBars, shortbread });

		for (const recipe of [lemonBars, shortbread]) {
			await deleteRecipeInEditor(page, recipe.title);
		}
	},
});

// From lg the filters sit in the sidebar; below it the toolbar's Filters button opens them.
async function openTagFilters(page: Page, isMobile: boolean): Promise<Locator> {
	if (isMobile) {
		const filters = page.getByRole('button', { name: /^Filters/ });
		await waitForHydration(filters);
		await filters.click();
	}
	const tags = page.getByRole('group', { name: 'Tags' });
	await expect(tags).toBeVisible();
	return tags;
}

// Where a tag falls, among the first shown or under More tags, depends on the counts develop holds.
async function tickTag(tags: Locator, tag: OwnTag) {
	const checkbox = tags.getByRole('checkbox', { name: tag.label });
	if (!(await checkbox.isVisible())) {
		await tags.getByText(/^More tags/).click();
	}
	await waitForHydration(checkbox);
	await checkbox.check();
}

// The tags the filters offer, each named with its count, in their order.
async function expectTagsOffered(tags: Locator, names: string[]) {
	const checkboxes = tags.getByRole('checkbox');
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

test('Browse filters by tags, offering only those that narrow its cards, and each chip takes its filter off', async ({
	page,
	isMobile,
	ownRecipes: { tags, lemonBars, shortbread },
}) => {
	await page.goto(recipeListPath);
	await tickTag(await openTagFilters(page, isMobile), tags.dessert);
	await page.getByRole('button', { name: 'Apply filters' }).click();
	await expect(page).toHaveURL(`${recipeListPath}?tag=${tags.dessert.inQuery}`);
	if (isMobile) {
		// Applying closes the filters and moves focus to the cards' heading.
		await expect(page.getByRole('group', { name: 'Tags' })).toBeHidden();
		await expect(page.getByRole('heading', { name: 'Recipes', level: 1 })).toBeFocused();
	}
	await expectActiveFilters(page, [tags.dessert.label]);
	await expectCards(page, [shortbread, lemonBars]);
	await expectHeaderSection(page, isMobile, browseMarked);

	// Both cards have Baking, so it is not offered; the checked Dessert always is.
	const tagFilters = await openTagFilters(page, isMobile);
	await expectTagsOffered(tagFilters, [`${tags.dessert.label} 2`, `${tags.makeAhead.label} 1`]);
	await tickTag(tagFilters, tags.makeAhead);
	await page.getByRole('button', { name: 'Apply filters' }).click();
	await expect(page).toHaveURL(
		`${recipeListPath}?tag=${tags.dessert.inQuery}&tag=${tags.makeAhead.inQuery}`
	);
	await expectActiveFilters(page, [tags.dessert.label, tags.makeAhead.label]);
	await expectCards(page, [lemonBars]);

	await page.getByRole('link', { name: `Remove ${tags.dessert.label}` }).click();
	await expect(page).toHaveURL(`${recipeListPath}?tag=${tags.makeAhead.inQuery}`);
	await expectActiveFilters(page, [tags.makeAhead.label]);
	await expectCards(page, [lemonBars]);

	await page.getByRole('link', { name: 'Clear filters' }).click();
	await expect(page).toHaveURL(recipeListPath);
	await expect(page.getByRole('list', { name: 'Active filters' })).toBeHidden();
	await expectHeaderSection(page, isMobile, browseMarked);
});

test('a search typed in the header on a filtered Browse keeps its filters, and Clear search returns to them', async ({
	page,
	isMobile,
	ownRecipes: { tags, lemonBars, shortbread },
}) => {
	await page.goto(`${recipeListPath}?tag=${tags.dessert.inQuery}`);
	await searchInHeader(page, isMobile, 'lemon');
	await expect(page).toHaveURL(`${recipeSearchPath}?q=lemon&tag=${tags.dessert.inQuery}`);
	await expectActiveFilters(page, ['“lemon”', tags.dessert.label]);
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
	await expect(page).toHaveURL(`${recipeListPath}?tag=${tags.dessert.inQuery}`);
	await expectActiveFilters(page, [tags.dessert.label]);
	await expectCards(page, [shortbread, lemonBars]);
	await expectHeaderSection(page, isMobile, browseMarked);
});

test('a recipe opened from a search marks no section, and its tag opens Browse filtered by it', async ({
	page,
	isMobile,
	ownRecipes: { tags, lemonBars, shortbread },
}) => {
	await page.goto(`${recipeSearchPath}?q=lemon&tag=${tags.dessert.inQuery}`);
	const row = page
		.getByRole('region', { name: 'Results' })
		.getByRole('link', { name: lemonBars.title });
	await waitForHydration(row);
	await row.click();
	await expect(page).toHaveURL(recipePath(slugify(lemonBars.title)));
	await expect(page.getByRole('link', { name: 'Back to search results' })).toBeVisible();
	await expectHeaderSection(page, isMobile, undefined);

	const tagLink = page
		.getByRole('article', { name: lemonBars.title })
		.getByRole('link', { name: tags.dessert.label });
	// Browse's own URL, so reading a recipe prefetches no search.
	await expect(tagLink).toHaveAttribute('href', `${recipeListPath}?tag=${tags.dessert.inQuery}`);
	await tagLink.click();
	await expect(page).toHaveURL(`${recipeListPath}?tag=${tags.dessert.inQuery}`);
	await expectActiveFilters(page, [tags.dessert.label]);
	await expectCards(page, [shortbread, lemonBars]);
	await expectHeaderSection(page, isMobile, browseMarked);
});
