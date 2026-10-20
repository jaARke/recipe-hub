import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { page, userEvent } from 'vitest/browser';
import { HeaderSearch } from '@/components/search/header-search';
import { RecipeResultsLoading } from '@/components/search/recipe-results-loading';

// Next's router, whose push the test makes show the page a search leads to.
const router = vi.hoisted(() => ({ push: vi.fn<(href: string) => void>() }));

vi.mock('next/navigation', async (importOriginal) => ({
	...(await importOriginal<typeof import('next/navigation')>()),
	useRouter: () => router,
}));

// Tailwind's lg breakpoint, from which the header's row holds the field.
const lgViewport = { width: 1024, height: 768 };

// The Recipes page's heading, which the search's focus moves to.
const resultsHeadingId = 'recipes-heading';

type SearchedPageProps = {
	// Resolves as the navigation arrives with the page's loading state.
	arrival: Promise<void>;
	resultsShown: boolean;
	// Whether the page the search leads to has the Recipes page's heading, which the not-found page,
	// shown for words search refuses, lacks.
	hasHeading: boolean;
};

// The page below the header: the one the search is typed on until a push navigates, in its
// transition, to the one it leads to, which arrives with the Recipes page's loading state and then
// shows its results.
function SearchedPage({ arrival, resultsShown, hasHeading }: SearchedPageProps) {
	const [searched, setSearched] = React.useState(false);
	React.useEffect(() => {
		router.push.mockImplementation(() => setSearched(true));
	}, []);
	if (!searched) {
		return <p>Desserts</p>;
	}
	React.use(arrival);
	if (!resultsShown) {
		return <RecipeResultsLoading />;
	}
	return hasHeading ? (
		<>
			<h1 id={resultsHeadingId} tabIndex={-1}>
				All Recipes
			</h1>
			<p>Results</p>
		</>
	) : (
		<p>Results</p>
	);
}

// The header's search above the page; arrive brings the navigation in, and showResults its results.
// A button beside them stands for the rest of the page, which can take focus as they load. Strict
// Mode runs effects twice, as the dev server does.
async function renderHeaderSearch({ hasHeading = true } = {}) {
	const arrival = Promise.withResolvers<void>();
	const header = (resultsShown: boolean) => (
		<React.StrictMode>
			<HeaderSearch idPrefix="header-search" queryName="q" resultsHeadingId={resultsHeadingId} />
			<button type="button">Elsewhere</button>
			<React.Suspense>
				<SearchedPage
					arrival={arrival.promise}
					resultsShown={resultsShown}
					hasHeading={hasHeading}
				/>
			</React.Suspense>
		</React.StrictMode>
	);
	const { rerender } = await render(header(false));
	return {
		arrive: () => arrival.resolve(),
		showResults: () => rerender(header(true)),
	};
}

// What a width hides leaves the accessibility tree, so a hidden control is found with includeHidden.
function searchField({ includeHidden = false } = {}) {
	return page.getByRole('searchbox', { name: 'Search recipes', includeHidden });
}

function searchIcon({ includeHidden = false } = {}) {
	return page.getByRole('button', { name: 'Search recipes', includeHidden });
}

function cancelButton() {
	return page.getByRole('button', { name: 'Cancel' });
}

function resultsHeading() {
	return page.getByRole('heading', { name: 'All Recipes' });
}

// Vitest's roles leave out the search element, so its landmark is found by its tag.
function searchLandmark() {
	return page.elementLocator(document.querySelector('search') ?? document.body);
}

function spinnerShown(): boolean {
	return searchLandmark().element().querySelector('[data-slot="spinner"]') !== null;
}

// The field holds the words, read-only, and the spinner takes its icon's place.
async function expectSearching(words: string) {
	await expect.element(searchField()).toHaveValue(words);
	await expect.element(searchField()).toHaveAttribute('readonly');
	expect(spinnerShown()).toBe(true);
}

afterEach(() => {
	vi.clearAllMocks();
});

describe('HeaderSearch', () => {
	it('opens the field from the search icon and focuses it in the same tap', async () => {
		await renderHeaderSearch();
		await expect.element(searchField({ includeHidden: true })).not.toBeVisible();

		await searchIcon().click();

		await expect.element(searchField()).toHaveFocus();
		await expect.element(cancelButton()).toBeVisible();
	});

	it('brings the row back on Cancel, keeping the words and focusing the icon', async () => {
		await renderHeaderSearch();
		await searchIcon().click();
		await searchField().fill('brown butter');

		await cancelButton().click();

		await expect.element(searchIcon()).toHaveFocus();
		await expect.element(searchField({ includeHidden: true })).not.toBeVisible();
		await searchIcon().click();
		await expect.element(searchField()).toHaveValue('brown butter');
	});

	it('empties and closes once its results show, giving its focus to the page’s heading', async () => {
		const { arrive, showResults } = await renderHeaderSearch();
		await searchIcon().click();
		await searchField().fill('lemon');
		await userEvent.keyboard('{Enter}');
		arrive();
		await expectSearching('lemon');

		await showResults();

		await expect.element(resultsHeading()).toHaveFocus();
		await expect.element(searchField({ includeHidden: true })).not.toBeVisible();
		await expect.element(searchField({ includeHidden: true })).toHaveValue('');
		await expect.element(searchIcon()).toBeVisible();
	});

	it('gives the page’s heading the focus Cancel held as its results show', async () => {
		const { arrive, showResults } = await renderHeaderSearch();
		await searchIcon().click();
		await searchField().fill('lemon');
		await userEvent.keyboard('{Enter}');
		arrive();
		await expectSearching('lemon');
		await userEvent.tab();
		await expect.element(cancelButton()).toHaveFocus();

		await showResults();

		await expect.element(resultsHeading()).toHaveFocus();
	});

	it('gives its focus to the search icon on a page with no Recipes heading', async () => {
		const { arrive, showResults } = await renderHeaderSearch({ hasHeading: false });
		await searchIcon().click();
		await searchField().fill('lemon');
		await userEvent.keyboard('{Enter}');
		arrive();
		await expectSearching('lemon');

		await showResults();

		await expect.element(page.getByText('Results')).toBeVisible();
		await expect.element(searchIcon()).toHaveFocus();
	});

	it('leaves focus where the reader moved it as the results loaded', async () => {
		const { arrive, showResults } = await renderHeaderSearch();
		await searchIcon().click();
		await searchField().fill('lemon');
		await userEvent.keyboard('{Enter}');
		arrive();
		await expectSearching('lemon');
		page.getByRole('button', { name: 'Elsewhere' }).element().focus();

		await showResults();

		await expect.element(resultsHeading()).toBeVisible();
		await expect.element(searchField({ includeHidden: true })).not.toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Elsewhere' })).toHaveFocus();
	});

	describe('from lg', () => {
		beforeEach(async () => {
			await page.viewport(lgViewport.width, lgViewport.height);
		});

		it('is a search landmark named as its field is, apart from the page’s own search', async () => {
			await renderHeaderSearch();

			await expect.element(searchLandmark()).toHaveAccessibleName('Search recipes');
			await expect.element(searchField()).toBeVisible();
			await expect.element(searchIcon({ includeHidden: true })).not.toBeVisible();
		});

		it('searches every recipe for its words alone, once however often Enter is pressed', async () => {
			await renderHeaderSearch();

			await searchField().fill('sugar');
			await userEvent.keyboard('{Enter}');
			await userEvent.keyboard('{Enter}');

			await expectSearching('sugar');
			expect(router.push.mock.calls).toEqual([['/?q=sugar']]);
		});

		it('keeps its words, read-only with a spinner, as it navigates and its results load, then empties and gives its focus to the page’s heading', async () => {
			const { arrive, showResults } = await renderHeaderSearch();
			await searchField().fill('lemon');
			await userEvent.keyboard('{Enter}');

			await expectSearching('lemon');
			// The navigation's transition keeps the page it was typed on until the new one arrives.
			await expect.element(page.getByText('Desserts')).toBeVisible();

			arrive();
			await expect.element(page.getByText('Desserts')).not.toBeInTheDocument();
			await expectSearching('lemon');

			await showResults();
			await expect.element(searchField()).toHaveValue('');
			await expect.element(searchField()).not.toHaveAttribute('readonly');
			expect(spinnerShown()).toBe(false);
			await expect.element(resultsHeading()).toHaveFocus();
		});
	});
});
