import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { getCachedRecipeSearchPage } from '@/app/_lib/recipe-cache';
import { PageContainer } from '@/components/layout/page-container';
import { RecipeListHeading } from '@/components/recipe/recipe-list-heading';
import { recipeListPath } from '@/components/recipe/recipe-paths';
import { HeaderSearchFieldsFromUrl } from '@/components/search/header-search-bar';
import { RecipeSearch, RecipeSearchSkeleton } from '@/components/search/recipe-search';
import {
	appliedFilterCount,
	parseRecipeSearchParams,
	recipeSearchHref,
	toRecipeSearchInput,
} from '@/components/search/search-params';
import { settings } from '@/lib/settings';

// The page's heading, which heads the cards and takes focus as they change.
const recipesHeadingId = 'recipes-heading';

// Every page names its normalized URL, so /?page=1 points at /. Filters multiply URLs, so a filtered
// list stays out of search engines and names Browse; its links are followed.
export async function generateMetadata({ searchParams }: PageProps<'/'>): Promise<Metadata> {
	const state = parseRecipeSearchParams(await searchParams);
	if (state === null) {
		return {};
	}

	return appliedFilterCount(state) === 0
		? { alternates: { canonical: recipeSearchHref(state) } }
		: { robots: { index: false, follow: true }, alternates: { canonical: recipeListPath } };
}

// Listed through search without words, for the counts its filters show. The proxy sends a request
// with words to Search.
async function RecipeList({ searchParams }: Pick<PageProps<'/'>, 'searchParams'>) {
	const state = parseRecipeSearchParams(await searchParams);
	if (state === null) {
		notFound();
	}

	// The first page carries the total, so a page past the end never reaches the database.
	const { recipesPerPage } = settings.display;
	const firstPage = await getCachedRecipeSearchPage(
		toRecipeSearchInput({ ...state, page: 1 }, recipesPerPage)
	);
	if (firstPage === null) {
		notFound();
	}
	const pageCount = Math.max(1, Math.ceil(firstPage.total / recipesPerPage));
	if (state.page > pageCount) {
		notFound();
	}

	const results =
		state.page === 1
			? firstPage
			: await getCachedRecipeSearchPage(toRecipeSearchInput(state, recipesPerPage));
	if (results === null) {
		notFound();
	}

	return (
		<RecipeSearch
			state={state}
			results={results}
			pageCount={pageCount}
			headingLevel={2}
			resultsHeadingId={recipesHeadingId}
		/>
	);
}

export default function RecipesPage({ searchParams }: PageProps<'/'>) {
	return (
		<PageContainer width="wide" className="flex flex-col gap-8 py-12 sm:py-16">
			<RecipeListHeading id={recipesHeadingId}>Recipes</RecipeListHeading>
			<HeaderSearchFieldsFromUrl searchParams={searchParams} />
			<Suspense fallback={<RecipeSearchSkeleton mode="browse" />}>
				<RecipeList searchParams={searchParams} />
			</Suspense>
		</PageContainer>
	);
}
