import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { searchRecipes } from '@/app/_lib/search-recipes';
import { PageContainer } from '@/components/layout/page-container';
import { HeaderSearchFields } from '@/components/search/header-search-bar';
import {
	RecipeSearch,
	RecipeSearchHint,
	RecipeSearchSkeleton,
} from '@/components/search/recipe-search';
import { parseRecipeSearchParams, toRecipeSearchInput } from '@/components/search/search-params';
import { settings } from '@/lib/settings';

// Results pages stay out of search engines even once recipes are indexed; their links are followed.
export const metadata: Metadata = {
	title: 'Search',
	robots: { index: false, follow: true },
};

// Not cached: every query and filter makes its own URL, so entries would rarely be reused. The proxy
// sends a search without words to Browse.
async function SearchResults({ searchParams }: Pick<PageProps<'/search'>, 'searchParams'>) {
	const state = parseRecipeSearchParams(await searchParams);
	if (state === null) {
		notFound();
	}

	const results = await searchRecipes(toRecipeSearchInput(state, settings.display.recipesPerPage));
	if (results === null) {
		notFound();
	}
	const pageCount = Math.max(1, Math.ceil(results.total / settings.display.recipesPerPage));
	if (state.page > pageCount) {
		notFound();
	}

	return (
		<>
			<HeaderSearchFields state={state} />
			<RecipeSearch state={state} results={results} pageCount={pageCount} headingLevel={2} />
		</>
	);
}

export default function SearchPage({ searchParams }: PageProps<'/search'>) {
	return (
		<PageContainer width="wide" className="flex flex-col gap-8 py-12 sm:py-16">
			<div className="flex flex-col gap-2">
				<h1 className="font-heading text-4xl font-semibold">Search</h1>
				<RecipeSearchHint />
			</div>
			<Suspense fallback={<RecipeSearchSkeleton mode="search" />}>
				<SearchResults searchParams={searchParams} />
			</Suspense>
		</PageContainer>
	);
}
