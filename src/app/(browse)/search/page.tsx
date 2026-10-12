import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { recipesPerPage } from '@/app/_lib/recipe-cache';
import { InvalidRecipeSearchError } from '@/application/search/errors';
import type { RecipeSearchInput, RecipeSearchPage } from '@/application/search/recipe-search-dtos';
import { PageContainer } from '@/components/layout/page-container';
import { RecipeSearch, RecipeSearchSkeleton } from '@/components/search/recipe-search';
import { parseRecipeSearchParams, toRecipeSearchInput } from '@/components/search/search-params';
import { getRecipeSearchService } from '@/composition/services';

// Results pages stay out of search engines even once recipes are indexed; their links are followed.
export const metadata: Metadata = {
	title: 'Search',
	robots: { index: false, follow: true },
};

// Input the service refuses, such as an overlong query, is a bad URL like any other.
async function searchRecipes(input: RecipeSearchInput): Promise<RecipeSearchPage> {
	try {
		return await getRecipeSearchService().searchRecipes(input);
	} catch (error) {
		if (error instanceof InvalidRecipeSearchError) {
			notFound();
		}
		throw error;
	}
}

// Not cached: every query and filter makes its own URL, so entries would rarely be reused.
async function SearchResults({ searchParams }: Pick<PageProps<'/search'>, 'searchParams'>) {
	const state = parseRecipeSearchParams(await searchParams);
	if (state === null) {
		notFound();
	}

	const results = await searchRecipes(toRecipeSearchInput(state, recipesPerPage));
	const pageCount = Math.max(1, Math.ceil(results.total / recipesPerPage));
	if (state.page > pageCount) {
		notFound();
	}

	return <RecipeSearch state={state} results={results} pageCount={pageCount} headingLevel={2} />;
}

export default function SearchPage({ searchParams }: PageProps<'/search'>) {
	return (
		<PageContainer width="wide" className="flex flex-col gap-8 py-12 sm:py-16">
			<h1 className="font-heading text-4xl font-medium">Search</h1>
			<Suspense fallback={<RecipeSearchSkeleton />}>
				<SearchResults searchParams={searchParams} />
			</Suspense>
		</PageContainer>
	);
}
