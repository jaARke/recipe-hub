import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache, Suspense } from 'react';
import { readRecipeSearchPage } from '@/app/_lib/recipe-cache';
import type { RecipeSearchPage } from '@/application/search/recipe-search-dtos';
import { PageContainer } from '@/components/layout/page-container';
import { recipeChapterRows } from '@/components/search/recipe-chapter-rows';
import type { RecipeChapterRow } from '@/components/search/recipe-chapters';
import {
	RecipeSearch,
	RecipeSearchSkeleton,
	RecipesPageGrid,
	recipesPageIdPrefix,
	RecipesViewHeader,
	RecipesViewHeaderSkeleton,
} from '@/components/search/recipe-search';
import {
	parseRecipeSearchParams,
	recipesCanonical,
	recipesViewName,
	toRecipeSearchInput,
	type RecipeSearchState,
} from '@/components/search/search-params';
import { settings } from '@/lib/settings';

type RecipesView = {
	state: RecipeSearchState;
	results: RecipeSearchPage;
	pageCount: number;
	chapterRows: RecipeChapterRow[];
};

// Titled by its view. Every recipe and each chapter are listed under their normalized URL; words and
// filters multiply URLs, so a view with either stays out of search engines and names its chapter, or
// every recipe. Its links are followed either way.
export async function generateMetadata({ searchParams }: PageProps<'/'>): Promise<Metadata> {
	const state = parseRecipeSearchParams(await searchParams);
	if (state === null) {
		return {};
	}

	const canonical = recipesCanonical(state);
	return {
		title: recipesViewName(state).title,
		alternates: { canonical: canonical.href },
		...(canonical.indexed ? {} : { robots: { index: false, follow: true } }),
	};
}

// Null for a page past the end, or for input search refuses. Without words every page is cached,
// so the first page's total turns away a page past the end before it reaches the database; with
// words each read is fresh, so the page asked for is read once and checked after.
async function readRecipesPage(
	state: RecipeSearchState
): Promise<Pick<RecipesView, 'results' | 'pageCount'> | null> {
	const { recipesPerPage } = settings.display;
	const read = (page: number) =>
		readRecipeSearchPage(toRecipeSearchInput({ ...state, page }, recipesPerPage));
	const pageCountOf = (total: number) => Math.max(1, Math.ceil(total / recipesPerPage));

	if (state.text === undefined && state.page > 1) {
		const firstPage = await read(1);
		if (firstPage === null || state.page > pageCountOf(firstPage.total)) {
			return null;
		}
	}
	const results = await read(state.page);
	if (results === null || state.page > pageCountOf(results.total)) {
		return null;
	}
	return { results, pageCount: pageCountOf(results.total) };
}

// Read once per request, by the same searchParams, whichever part of the page asks first, so the
// header's chapter list and the results share one search.
const readRecipesView = cache(
	async (searchParams: PageProps<'/'>['searchParams']): Promise<RecipesView | null> => {
		const state = parseRecipeSearchParams(await searchParams);
		if (state === null) {
			return null;
		}

		const page = await readRecipesPage(state);
		return page === null
			? null
			: { state, ...page, chapterRows: recipeChapterRows(state, page.results.facets) };
	}
);

// Shown from the URL alone, before the results; the heading's chapter list follows with their counts.
async function ViewHeader({ searchParams }: Pick<PageProps<'/'>, 'searchParams'>) {
	const state = parseRecipeSearchParams(await searchParams);
	if (state === null) {
		notFound();
	}

	return (
		<RecipesViewHeader
			idPrefix={recipesPageIdPrefix}
			state={state}
			chapterRows={readRecipesView(searchParams).then((view) => view?.chapterRows ?? [])}
		/>
	);
}

// A refused value or a page past the end shows the not-found page, which streams in place of the
// page with its noindex, after the 200 has gone.
async function Results({ searchParams }: Pick<PageProps<'/'>, 'searchParams'>) {
	const view = await readRecipesView(searchParams);
	if (view === null) {
		notFound();
	}

	return <RecipeSearch idPrefix={recipesPageIdPrefix} {...view} />;
}

// Everything that reads the URL waits in a Suspense boundary, so the page's shell, which a link
// prefetches, holds only the skeletons and never runs a search.
export default function RecipesPage({ searchParams }: PageProps<'/'>) {
	return (
		<PageContainer width="wide" className="py-12 sm:py-16">
			<RecipesPageGrid>
				<Suspense fallback={<RecipesViewHeaderSkeleton />}>
					<ViewHeader searchParams={searchParams} />
				</Suspense>
				<Suspense fallback={<RecipeSearchSkeleton />}>
					<Results searchParams={searchParams} />
				</Suspense>
			</RecipesPageGrid>
		</PageContainer>
	);
}
