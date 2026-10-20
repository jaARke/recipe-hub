import { randomUUID } from 'node:crypto';
import type { Locator, Page } from '@playwright/test';
import { recipeListPath } from '@/components/recipe/recipe-paths';
import { expect, test as base } from './support/fixtures';
import { expectHeaderSection } from './support/header-section';
import { waitForHydration } from './support/hydration';
import { withOwnRecipes, type OwnRecipe } from './support/own-recipes';
import { openChapterPicker, openFilterSheet, recipesResults } from './support/recipes-page';
import { testMemberName } from './support/test-members';

// The Recipes page: its chapters, in the heading's sheet below lg and the sidebar from lg; Filter and
// sort, applied through its sheet below lg and at once from lg; its search box; and the header's
// search. Each test lists only the recipes its own member added, by the member's id in the URL, so
// develop's other recipes never show in what it counts or lists.

type OwnRecipes = {
	// Cookies & Candy for Easter, vegetarian and gluten-free, and the only one with lemon in it.
	lemonBars: OwnRecipe;
	// Desserts for Christmas, vegetarian, and added last, so All Recipes lists it first.
	gingerbread: OwnRecipe;
};

const test = base.extend<{ ownRecipes: OwnRecipes }>({
	ownRecipes: async ({ page, signIn }, use) => {
		const run = randomUUID().slice(0, 8);
		await signIn();
		await withOwnRecipes(
			page,
			{
				lemonBars: {
					title: `End-to-end lemon bars ${run}`,
					ingredient: '3 lemons',
					step: 'Bake until set.',
					chapter: 'Cookies & Candy',
					holidays: ['Easter'],
					diets: ['Vegetarian', 'Gluten-free'],
				},
				gingerbread: {
					title: `End-to-end gingerbread ${run}`,
					ingredient: '1 tablespoon ground ginger',
					step: 'Bake until springy.',
					chapter: 'Desserts',
					holidays: ['Christmas'],
					diets: ['Vegetarian'],
				},
			},
			use
		);
	},
});

// A row of the chapter list: All Recipes or a chapter, and how many of the view's recipes it holds.
type ChapterCount = { label: string; count: number };

// The member's recipes in each row, All Recipes first, then the chapters in the cookbook's order.
const memberChapterCounts: ChapterCount[] = [
	{ label: 'All Recipes', count: 2 },
	{ label: 'Breakfast & Brunch', count: 0 },
	{ label: 'Appetizers & Beverages', count: 0 },
	{ label: 'Soups & Salads', count: 0 },
	{ label: 'Vegetables & Side Dishes', count: 0 },
	{ label: 'Main Dishes', count: 0 },
	{ label: 'Breads & Rolls', count: 0 },
	{ label: 'Desserts', count: 1 },
	{ label: 'Cookies & Candy', count: 1 },
	{ label: 'This & That', count: 0 },
];

const addedByMember = `Added by ${testMemberName}`;

// The Recipes page, with or without words, is the section's own page.
const recipesMarked = { section: 'Recipes', ariaCurrent: 'page' } as const;

// The page's h1, which names the view.
function viewHeading(page: Page, name: string): Locator {
	return page.getByRole('heading', { name, level: 1, exact: true });
}

// The count line, such as "2 recipes, newest first".
async function expectCount(page: Page, text: string) {
	await expect(recipesResults(page).getByRole('status')).toHaveText(text);
}

// The recipes listed, in their order.
async function expectListed(page: Page, recipes: OwnRecipe[]) {
	await expect(recipesResults(page).getByRole('heading', { level: 3 })).toHaveText(
		recipes.map(({ title }) => title)
	);
}

// The filters applied, as chips after "Filtered by:", each named for the filter it removes.
async function expectChips(page: Page, labels: string[]) {
	await expect(page.getByRole('list', { name: 'Filtered by:' }).getByRole('link')).toHaveText(
		labels.map((label) => `Remove ${label}`)
	);
}

// The chapter list: below lg in the heading's sheet, each row named with its count in recipes; from lg
// in the sidebar, with the count alone.
async function openChapters(page: Page, isMobile: boolean): Promise<Locator> {
	return isMobile ? openChapterPicker(page) : page.getByRole('navigation', { name: 'Chapters' });
}

async function expectChapterRows(chapters: Locator, isMobile: boolean, counts: ChapterCount[]) {
	const rows = chapters.getByRole('link');
	await expect(rows).toHaveCount(counts.length);
	for (const [index, { label, count }] of counts.entries()) {
		const recipes = count === 1 ? '1 recipe' : `${count} recipes`;
		await expect(rows.nth(index)).toHaveAccessibleName(
			isMobile ? `${label} ${recipes}` : `${label} ${count}`
		);
	}
}

// Searches within the view from the page's own field, labelled with the view's name.
async function searchThePage(page: Page, label: string, words: string) {
	const field = page.getByRole('searchbox', { name: label, exact: true });
	await waitForHydration(field);
	await field.fill(words);
	await field.press('Enter');
}

// The header's field; below lg its icon opens it across the header's row.
async function openHeaderSearch(page: Page, isMobile: boolean): Promise<Locator> {
	if (isMobile) {
		const openField = page.getByRole('button', { name: 'Search recipes' });
		await waitForHydration(openField);
		await openField.click();
	}
	const field = page.getByRole('searchbox', { name: 'Search recipes', exact: true });
	await waitForHydration(field);
	return field;
}

// What the header's field showed while its search for the words ran, and as it ended.
type HeaderSearchRecord = {
	// Whether it held the words, read-only beside a spinner.
	heldWords: boolean;
	// As it stopped being read-only: its value, whether the results' count line showed the words, and
	// whether the results' skeletons still showed.
	endedWith?: { value: string; resultsShown: boolean; loading: boolean };
};

// Watches the header's field from before its search starts, as each change to the page commits, and
// keeps what it saw on the page's root, where headerSearchRecord reads it.
async function watchHeaderSearch(field: Locator, words: string) {
	await field.evaluate((input, searched) => {
		if (!(input instanceof HTMLInputElement)) {
			throw new Error('The header’s search field is no input');
		}
		const record: HeaderSearchRecord = { heldWords: false };
		const statusSays = (text: string) =>
			[...document.querySelectorAll('[role="status"]')].some((status) =>
				(status.textContent ?? '').includes(text)
			);
		const observer = new MutationObserver(() => {
			if (input.readOnly) {
				record.heldWords ||=
					input.value === searched &&
					input.form !== null &&
					input.form.querySelector('[data-slot="spinner"]') !== null;
			} else if (record.heldWords) {
				record.endedWith = {
					value: input.value,
					resultsShown: statusSays(`matching “${searched}”`),
					loading: statusSays('Loading recipes'),
				};
				observer.disconnect();
			}
			document.documentElement.dataset.headerSearch = JSON.stringify(record);
		});
		observer.observe(document.body, {
			subtree: true,
			childList: true,
			attributes: true,
			characterData: true,
		});
	}, words);
}

async function headerSearchRecord(page: Page): Promise<HeaderSearchRecord | undefined> {
	const json = await page.locator('html').getAttribute('data-header-search');
	return json === null ? undefined : (JSON.parse(json) as HeaderSearchRecord);
}

test('the chapters lead into a chapter, each counted within the filters, and Back to All Recipes leads out with them', async ({
	page,
	isMobile,
	member,
	ownRecipes: { lemonBars, gingerbread },
}) => {
	const byMember = `contributor=${member.id}`;
	const allRecipes = `${recipeListPath}?${byMember}`;
	await page.goto(allRecipes);
	await expect(viewHeading(page, 'All Recipes')).toBeVisible();
	await expectCount(page, '2 recipes, newest first');
	await expectListed(page, [gingerbread, lemonBars]);

	const chapters = await openChapters(page, isMobile);
	await expectChapterRows(chapters, isMobile, memberChapterCounts);
	await expect(chapters.getByRole('link', { name: /^All Recipes/ })).toHaveAttribute(
		'aria-current',
		'page'
	);
	const cookiesCandy = chapters.getByRole('link', { name: /^Cookies & Candy/ });
	await waitForHydration(cookiesCandy);
	await cookiesCandy.click();
	await expect(page).toHaveURL(`${recipeListPath}?chapter=cookies-candy&${byMember}`);
	if (isMobile) {
		// The row closes the sheet, and focus lands on the heading, which names the chapter.
		await expect(chapters).toBeHidden();
		await expect(viewHeading(page, 'Cookies & Candy')).toBeFocused();
	} else {
		await expect(viewHeading(page, 'Cookies & Candy')).toBeVisible();
		await expect(cookiesCandy).toHaveAttribute('aria-current', 'page');
	}
	// A chapter lists A to Z, within the filters.
	await expectCount(page, '1 recipe, A to Z');
	await expectListed(page, [lemonBars]);
	await expectChips(page, [addedByMember]);
	await expectHeaderSection(page, isMobile, recipesMarked);

	const backToAllRecipes = page.getByRole('link', { name: 'Back to All Recipes' });
	await waitForHydration(backToAllRecipes);
	await backToAllRecipes.click();
	await expect(page).toHaveURL(allRecipes);
	await expect(viewHeading(page, 'All Recipes')).toBeVisible();
	await expect(backToAllRecipes).toBeHidden();
	await expectCount(page, '2 recipes, newest first');
	await expectListed(page, [gingerbread, lemonBars]);
});

test('Filter and sort applies each choice at once from lg, and below lg with its sheet’s Show, which counts first; chips and Clear all take filters off', async ({
	page,
	isMobile,
	member,
	ownRecipes: { lemonBars, gingerbread },
}) => {
	const byMember = `contributor=${member.id}`;
	const allRecipes = `${recipeListPath}?${byMember}`;
	const forEaster = `${recipeListPath}?holiday=easter&${byMember}`;
	await page.goto(allRecipes);

	if (isMobile) {
		const sheet = await openFilterSheet(page);
		await expect(sheet.getByRole('button', { name: 'Show 2 recipes' })).toBeVisible();
		await sheet.getByRole('checkbox', { name: 'Easter (1)' }).check();
		// Counted before it applies, without leaving the view.
		const show = sheet.getByRole('button', { name: 'Show 1 recipe' });
		await expect(show).toBeVisible();
		await expect(page).toHaveURL(allRecipes);
		await show.click();
		await expect(sheet).toBeHidden();
		await expect(page).toHaveURL(forEaster);
		await expect(viewHeading(page, 'All Recipes')).toBeFocused();
	} else {
		const easter = page
			.getByRole('region', { name: 'Filter and sort' })
			.getByRole('checkbox', { name: 'Easter (1)' });
		await waitForHydration(easter);
		await easter.check();
		await expect(page).toHaveURL(forEaster);
		// The sidebar stays as the view changes, so focus stays on the box.
		await expect(easter).toBeFocused();
		await expect(easter).toBeChecked();

		// Each choice is an entry in the tab's history, which Back takes off.
		await page.goBack();
		await expect(page).toHaveURL(allRecipes);
		await expect(easter).not.toBeChecked();
		await page.goForward();
		await expect(page).toHaveURL(forEaster);
		await expect(easter).toBeChecked();
	}
	await expectCount(page, '1 recipe, newest first');
	await expectListed(page, [lemonBars]);
	await expectChips(page, ['Easter', addedByMember]);

	// A chip takes its own filter off, and focus, which fell with it, moves to the heading.
	const removeEaster = page.getByRole('link', { name: 'Remove Easter' });
	await waitForHydration(removeEaster);
	await removeEaster.click();
	await expect(page).toHaveURL(allRecipes);
	await expectChips(page, [addedByMember]);
	await expectListed(page, [gingerbread, lemonBars]);
	await expect(viewHeading(page, 'All Recipes')).toBeFocused();
	const clearAll = recipesResults(page).getByRole('link', { name: 'Clear all' });
	await expect(clearAll).toBeHidden();

	// Among two chips or more, Clear all takes every filter off and keeps the words and the chapter.
	await page.goto(`${recipeListPath}?q=lemon&chapter=cookies-candy&holiday=easter&${byMember}`);
	await expectChips(page, ['Easter', addedByMember]);
	await expectListed(page, [lemonBars]);
	await waitForHydration(clearAll);
	await clearAll.click();
	await expect(page).toHaveURL(`${recipeListPath}?q=lemon&chapter=cookies-candy`);
	await expect(page.getByRole('list', { name: 'Filtered by:' })).toBeHidden();
	await expect(viewHeading(page, 'Cookies & Candy')).toBeVisible();
	await expect(
		page.getByRole('searchbox', { name: 'Search Cookies & Candy', exact: true })
	).toHaveValue('lemon');
});

test('the page’s search looks within the chapter and the filters, its × clears only the words, and an empty search offers every chapter', async ({
	page,
	member,
	ownRecipes: { lemonBars, gingerbread },
}) => {
	const byMember = `contributor=${member.id}`;
	const cookiesCandy = `${recipeListPath}?chapter=cookies-candy&${byMember}`;
	await page.goto(cookiesCandy);
	await searchThePage(page, 'Search Cookies & Candy', 'lemon');
	await expect(page).toHaveURL(`${recipeListPath}?q=lemon&chapter=cookies-candy&${byMember}`);
	await expectCount(page, '1 recipe matching “lemon”, best match first');
	await expectListed(page, [lemonBars]);

	const clearSearch = page.getByRole('link', { name: 'Clear search' });
	await waitForHydration(clearSearch);
	await clearSearch.click();
	await expect(page).toHaveURL(cookiesCandy);
	await expect(
		page.getByRole('searchbox', { name: 'Search Cookies & Candy', exact: true })
	).toHaveValue('');
	await expectCount(page, '1 recipe, A to Z');

	await searchThePage(page, 'Search Cookies & Candy', 'gingerbread');
	await expect(page).toHaveURL(`${recipeListPath}?q=gingerbread&chapter=cookies-candy&${byMember}`);
	const results = recipesResults(page);
	await expect(
		results.getByText('No recipes in Cookies & Candy match “gingerbread” with these filters.')
	).toBeVisible();
	for (const wayOut of ['Clear search', 'Clear filters', 'Search All Recipes for “gingerbread”']) {
		await expect(results.getByRole('link', { name: wayOut, exact: true })).toBeVisible();
	}
	const searchAllRecipes = results.getByRole('link', {
		name: 'Search All Recipes for “gingerbread”',
	});
	await waitForHydration(searchAllRecipes);
	await searchAllRecipes.click();
	await expect(page).toHaveURL(`${recipeListPath}?q=gingerbread&${byMember}`);
	await expect(viewHeading(page, 'All Recipes')).toBeVisible();
	await expectListed(page, [gingerbread]);
});

test('the header’s search looks through every recipe, holding its words beside a spinner until the results show, then empties', async ({
	page,
	isMobile,
	member,
	ownRecipes: { lemonBars },
}) => {
	await page.goto(
		`${recipeListPath}?chapter=cookies-candy&holiday=easter&contributor=${member.id}`
	);
	const field = await openHeaderSearch(page, isMobile);
	// The recipe's whole title, which only it has, since the search leaves the member's filter behind.
	const words = lemonBars.title;
	await watchHeaderSearch(field, words);
	await field.fill(words);
	await field.press('Enter');

	// Every chapter, without the filters.
	await expect(page).toHaveURL(`${recipeListPath}?${new URLSearchParams({ q: words })}`);
	await expect(viewHeading(page, 'All Recipes')).toBeVisible();
	await expect(page.getByRole('list', { name: 'Filtered by:' })).toBeHidden();
	await expectCount(page, `1 recipe matching “${words}”, best match first`);
	await expectListed(page, [lemonBars]);
	// The page's own field holds the words.
	await expect(
		page.getByRole('searchbox', { name: 'Search All Recipes', exact: true })
	).toHaveValue(words);
	await expect
		.poll(() => headerSearchRecord(page))
		.toEqual({
			heldWords: true,
			endedWith: { value: '', resultsShown: true, loading: false },
		});
	if (isMobile) {
		// It closes, and its icon takes focus.
		await expect(field).toBeHidden();
		await expect(page.getByRole('button', { name: 'Search recipes' })).toBeFocused();
	} else {
		await expect(field).toHaveValue('');
		await expect(field).toBeEditable();
	}
	await expectHeaderSection(page, isMobile, recipesMarked);
});

test('a link to the retired search page lands on the Recipes page with its query', async ({
	page,
}) => {
	const response = await page.request.get('/search?q=soup&chapter=soups-salads', {
		maxRedirects: 0,
	});
	expect(response.status()).toBe(308);
	expect(response.headers().location).toBe('/?q=soup&chapter=soups-salads');

	await page.goto('/search?q=soup');
	await expect(page).toHaveURL(`${recipeListPath}?q=soup`);
	await expect(viewHeading(page, 'All Recipes')).toBeVisible();
	await expect(
		page.getByRole('searchbox', { name: 'Search All Recipes', exact: true })
	).toHaveValue('soup');
});
