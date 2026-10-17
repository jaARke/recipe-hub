import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import { holdPageLoads } from '@/components/auth/testing/page-loads';
import { RecipeBackLink } from '@/components/recipe/recipe-back-link';
import { stubTabNavigation } from '@/components/recipe/testing/tab-navigation';
import { writeTabStorage } from '@/lib/browser-storage';

const origin = location.origin;
const recipePathname = '/recipes/lemon-bars';
const favoritesUrl = `${origin}/favorites?page=2`;

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	sessionStorage.clear();
});

describe('RecipeBackLink', () => {
	it('names the list and goes back in history to its page', async () => {
		// Holds page loads through the browser's own Navigation API, before the stub stands in for it.
		const loads = holdPageLoads();
		stubTabNavigation([`${origin}/`, favoritesUrl, `${origin}${recipePathname}`]);
		writeTabStorage(`opened-from:${recipePathname}`, favoritesUrl);
		const go = vi.spyOn(history, 'go').mockImplementation(() => {});
		await render(<RecipeBackLink recipePathname={recipePathname} />);

		const link = page.getByRole('link', { name: 'Back to Favorites' });
		await expect.element(link).toHaveAttribute('href', favoritesUrl);
		await link.click();

		expect(go).toHaveBeenCalledExactlyOnceWith(-1);
		expect(loads).toEqual([]);
	});

	it('goes back past the entries a jump within the recipe added', async () => {
		const loads = holdPageLoads();
		const searchUrl = `${origin}/search?q=lemon&sort=newest`;
		stubTabNavigation([
			searchUrl,
			`${origin}${recipePathname}`,
			`${origin}${recipePathname}#lemon-bars-original`,
		]);
		writeTabStorage(`opened-from:${recipePathname}`, searchUrl);
		const go = vi.spyOn(history, 'go').mockImplementation(() => {});
		await render(<RecipeBackLink recipePathname={recipePathname} />);

		await page.getByRole('link', { name: 'Back to search results' }).click();

		expect(go).toHaveBeenCalledExactlyOnceWith(-2);
		expect(loads).toEqual([]);
	});

	it('follows a history entry written while React commits, once the commit is done', async () => {
		const tab = stubTabNavigation([favoritesUrl, `${origin}${recipePathname}`]);
		writeTabStorage(`opened-from:${recipePathname}`, favoritesUrl);
		const consoleError = vi.spyOn(console, 'error');
		// Writes the tab's history in an insertion effect, as Next's router does on navigating.
		function HistoryWriter({ url }: { url?: string }) {
			React.useInsertionEffect(() => {
				if (url !== undefined) {
					tab.push(url);
				}
			}, [url]);
			return null;
		}
		const { rerender } = await render(
			<>
				<RecipeBackLink recipePathname={recipePathname} />
				<HistoryWriter />
			</>
		);
		await expect
			.element(page.getByRole('link', { name: 'Back to Favorites' }))
			.toHaveAttribute('href', favoritesUrl);

		await rerender(
			<>
				<RecipeBackLink recipePathname={recipePathname} />
				<HistoryWriter url={`${origin}/`} />
			</>
		);

		await expect.element(page.getByRole('link')).not.toBeInTheDocument();
		expect(consoleError).not.toHaveBeenCalled();
	});

	it('shows none for a recipe reached from another page than the list', async () => {
		stubTabNavigation([
			favoritesUrl,
			`${origin}${recipePathname}/edit`,
			`${origin}${recipePathname}`,
		]);
		writeTabStorage(`opened-from:${recipePathname}`, favoritesUrl);
		await render(<RecipeBackLink recipePathname={recipePathname} />);

		await expect.element(page.getByRole('link')).not.toBeInTheDocument();
	});

	it('shows none where the history the browser reports is not the address shown', async () => {
		stubTabNavigation([favoritesUrl, `${origin}${recipePathname}`]);
		writeTabStorage(`opened-from:${recipePathname}`, favoritesUrl);
		// As in a browser whose Navigation API missed the entries the page pushed since.
		history.replaceState(null, '', `${origin}/recipes/sunday-pot-roast`);
		await render(<RecipeBackLink recipePathname={recipePathname} />);

		await expect.element(page.getByRole('link')).not.toBeInTheDocument();
	});

	it('shows none where the browser has no Navigation API', async () => {
		vi.stubGlobal('navigation', undefined);
		writeTabStorage(`opened-from:${recipePathname}`, favoritesUrl);
		await render(<RecipeBackLink recipePathname={recipePathname} />);

		await expect.element(page.getByRole('link')).not.toBeInTheDocument();
	});
});
