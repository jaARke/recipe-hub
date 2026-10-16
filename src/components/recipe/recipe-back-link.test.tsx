import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
		stubTabNavigation([`${origin}/`, favoritesUrl, `${origin}${recipePathname}`]);
		writeTabStorage(`opened-from:${recipePathname}`, favoritesUrl);
		const go = vi.spyOn(history, 'go').mockImplementation(() => {});
		render(<RecipeBackLink recipePathname={recipePathname} />);

		const link = screen.getByRole('link', { name: 'Back to Favorites' });
		expect(link.getAttribute('href')).toBe(favoritesUrl);
		await userEvent.click(link);

		expect(go).toHaveBeenCalledWith(-1);
	});

	it('goes back past the entries a jump within the recipe added', async () => {
		const searchUrl = `${origin}/search?q=lemon&sort=newest`;
		stubTabNavigation([
			searchUrl,
			`${origin}${recipePathname}`,
			`${origin}${recipePathname}#lemon-bars-original`,
		]);
		writeTabStorage(`opened-from:${recipePathname}`, searchUrl);
		const go = vi.spyOn(history, 'go').mockImplementation(() => {});
		render(<RecipeBackLink recipePathname={recipePathname} />);

		await userEvent.click(screen.getByRole('link', { name: 'Back to search results' }));

		expect(go).toHaveBeenCalledWith(-2);
	});

	it('shows none for a recipe reached from another page than the list', () => {
		stubTabNavigation([
			favoritesUrl,
			`${origin}${recipePathname}/edit`,
			`${origin}${recipePathname}`,
		]);
		writeTabStorage(`opened-from:${recipePathname}`, favoritesUrl);
		render(<RecipeBackLink recipePathname={recipePathname} />);

		expect(screen.queryByRole('link')).toBeNull();
	});

	it("shows none in a new tab, even given this tab's record", () => {
		stubTabNavigation([`${origin}${recipePathname}`]);
		writeTabStorage(`opened-from:${recipePathname}`, favoritesUrl);
		render(<RecipeBackLink recipePathname={recipePathname} />);

		expect(screen.queryByRole('link')).toBeNull();
	});

	it('shows none where the history the browser reports is not the address shown', () => {
		stubTabNavigation([favoritesUrl, `${origin}${recipePathname}`]);
		writeTabStorage(`opened-from:${recipePathname}`, favoritesUrl);
		// As in a browser whose Navigation API missed the entries the page pushed since.
		history.replaceState(null, '', `${origin}/recipes/sunday-pot-roast`);
		render(<RecipeBackLink recipePathname={recipePathname} />);

		expect(screen.queryByRole('link')).toBeNull();
	});

	it('shows none where the browser has no Navigation API', () => {
		writeTabStorage(`opened-from:${recipePathname}`, favoritesUrl);
		render(<RecipeBackLink recipePathname={recipePathname} />);

		expect(screen.queryByRole('link')).toBeNull();
	});
});
