import type { Page } from '@playwright/test';
import {
	accountPath,
	adminPath,
	privacyPath,
	requestAccessPath,
	signInPath,
} from '@/components/auth/auth-paths';
import { recipeImportPath } from '@/components/recipe-import/recipe-import-paths';
import {
	contributePath,
	favoritesPath,
	recipeEditPath,
	recipeListPath,
	recipeSearchPath,
} from '@/components/recipe/recipe-paths';
import { recipeSearchParamNames } from '@/components/search/search-params';
import { hrefWithParams } from '@/lib/url-query';
import { test as setup } from './support/fixtures';
import { waitForHydration } from './support/hydration';
import { sampleRecipe } from './support/sample-recipe';
import { seedLinkImportDraft } from './support/test-imports';

// Long enough for `next dev` to compile a page's server and client code on its first request.
const coldPageTimeoutMs = 60_000;

const signedOutPaths = [
	recipeListPath,
	sampleRecipe.path,
	sampleRecipe.cookPath,
	favoritesPath,
	// A search without words is Browse, so the search page compiles for one with words.
	hrefWithParams(recipeSearchPath, new URLSearchParams({ [recipeSearchParamNames.text]: 'soup' })),
	signInPath,
	requestAccessPath,
	privacyPath,
];

async function loadAndHydrate(page: Page, path: string) {
	await page.goto(path, { timeout: coldPageTimeoutMs });
	await waitForHydration(page.getByRole('main'), { timeout: coldPageTimeoutMs });
}

setup.use({ memberRole: 'admin' });

// `next dev` compiles a page on its first request, which can reload pages other tests have open.
setup(
	'each page the suites visit compiles and hydrates before they run',
	async ({ page, develop, member, signIn }) => {
		for (const path of signedOutPaths) {
			await loadAndHydrate(page, path);
		}

		const recipeImport = await seedLinkImportDraft(develop.db, member, {
			sourceUrl: 'https://example.com/lemonade',
			recipe: {
				title: 'Lemonade',
				times: {},
				ingredientSections: [{ lines: ['4 lemons'] }],
				instructionSections: [{ steps: ['Squeeze the lemons.'] }],
				reviewNotes: [],
			},
		});
		await signIn();
		for (const path of [
			contributePath,
			recipeImportPath(recipeImport.id),
			recipeEditPath(sampleRecipe.slug),
			accountPath,
			adminPath,
		]) {
			await loadAndHydrate(page, path);
		}
	}
);
