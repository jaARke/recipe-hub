import type { RecipeSearchSort } from '@/application/ports/recipe-search';
import type { RecipeSearchPage } from '@/application/search/recipe-search-dtos';
import { RecipePagination } from '@/components/recipe/recipe-pagination';
import { recipeSearchPath } from '@/components/recipe/recipe-paths';
import { RecipeSortForm, RecipeSortFormSkeleton } from '@/components/recipe/recipe-sort-form';
import { HiddenSearchFields } from '@/components/search/hidden-search-fields';
import { RecipeSearchActiveFilters } from '@/components/search/recipe-search-active-filters';
import { RecipeSearchEmptyState } from '@/components/search/recipe-search-empty-state';
import {
	RecipeSearchFiltersDisclosure,
	RecipeSearchFiltersSidebar,
} from '@/components/search/recipe-search-filters';
import { RecipeSearchForm } from '@/components/search/recipe-search-form';
import {
	firstResultCount,
	RecipeSearchResult,
	RecipeSearchResultList,
	RecipeSearchResultSkeleton,
} from '@/components/search/recipe-search-result';
import {
	recipeSearchHref,
	recipeSearchSortsFor,
	type RecipeSearchState,
} from '@/components/search/search-params';
import { Skeleton } from '@/components/ui/skeleton';

// Keyed by the sections' level; level 4 nests search under the design reference's own headings.
const searchHeadingTags = {
	2: { section: 'h2', result: 'h3' },
	4: { section: 'h4', result: 'h5' },
} as const;

type SearchHeadingLevel = keyof typeof searchHeadingTags;

const sortDescriptions: Record<RecipeSearchSort, string> = {
	relevance: 'best match first',
	newest: 'newest first',
	title: 'A to Z',
};

// Enough rows to fill the first screen while results load.
const skeletonResultCount = 5;

const countFormat = new Intl.NumberFormat('en-US');

function recipeCount(total: number): string {
	return total === 1 ? '1 recipe' : `${countFormat.format(total)} recipes`;
}

// Read after the count, so a new query, order, or page is announced even when the count is unchanged.
function resultsDescription(
	state: RecipeSearchState,
	results: RecipeSearchPage,
	pageCount: number
): string {
	const details = [
		results.match === 'close' ? 'close matches' : undefined,
		sortDescriptions[state.sort],
		pageCount > 1 ? `page ${state.page} of ${pageCount}` : undefined,
	].filter((detail) => detail !== undefined);
	const query = state.text === undefined ? '' : ` for “${state.text}”`;
	return `${query}, ${details.join(', ')}`;
}

function RecipeSearchCloseMatches({ text }: { text: string }) {
	return <p className="text-sm">No exact matches for “{text}”. Showing close matches.</p>;
}

function RecipeSearch({
	state,
	results,
	pageCount,
	headingLevel,
}: {
	state: RecipeSearchState;
	results: RecipeSearchPage;
	pageCount: number;
	headingLevel: SearchHeadingLevel;
}) {
	const { section: Section, result: resultHeadingTag } = searchHeadingTags[headingLevel];
	const resultsHeadingId = 'search-results-heading';

	return (
		<div className="flex flex-col gap-8">
			<RecipeSearchForm state={state} />
			<div className="flex flex-col gap-8 lg:flex-row lg:items-start">
				<RecipeSearchFiltersDisclosure
					idPrefix="search-filters-disclosure"
					state={state}
					facets={results.facets}
					headingTag={Section}
					className="lg:hidden"
				/>
				<RecipeSearchFiltersSidebar
					idPrefix="search-filters-sidebar"
					state={state}
					facets={results.facets}
					headingTag={Section}
					className="hidden lg:flex lg:w-64 lg:shrink-0"
				/>
				<section aria-labelledby={resultsHeadingId} className="flex min-w-0 flex-1 flex-col gap-6">
					<Section id={resultsHeadingId} className="sr-only">
						Results
					</Section>
					<RecipeSearchActiveFilters state={state} />
					<div className="flex flex-wrap items-center justify-between gap-4">
						{/* Outside any keyed subtree, so it stays in place and each new count is announced. */}
						<p role="status" className="text-sm text-muted-foreground">
							{recipeCount(results.total)}
							<span className="sr-only">{resultsDescription(state, results, pageCount)}</span>
						</p>
						{results.total > 0 && (
							<RecipeSortForm
								id="search-sort"
								action={recipeSearchPath}
								sorts={recipeSearchSortsFor(state.text)}
								value={state.sort}
							>
								<HiddenSearchFields state={state} editedFields={['sort']} />
							</RecipeSortForm>
						)}
					</div>
					{results.match === 'close' && state.text !== undefined && (
						<RecipeSearchCloseMatches text={state.text} />
					)}
					{results.results.length > 0 ? (
						<RecipeSearchResultList>
							{results.results.map((result, index) => (
								<li key={result.recipe.id}>
									<RecipeSearchResult
										result={result}
										headingTag={resultHeadingTag}
										eager={index < firstResultCount}
									/>
								</li>
							))}
						</RecipeSearchResultList>
					) : (
						<RecipeSearchEmptyState state={state} />
					)}
					{pageCount > 1 && (
						<RecipePagination
							page={state.page}
							pageCount={pageCount}
							pageHref={(page) => recipeSearchHref({ ...state, page })}
						/>
					)}
				</section>
			</div>
		</div>
	);
}

function RecipeSearchSkeleton() {
	return (
		<div role="status">
			<span className="sr-only">Loading results</span>
			<div aria-hidden="true" className="flex flex-col gap-8">
				<div className="flex max-w-2xl flex-col gap-3">
					<div className="flex gap-2">
						<Skeleton className="h-9 flex-1" />
						<Skeleton className="h-9 w-20" />
					</div>
					<Skeleton className="h-5 w-3/4" />
				</div>
				<div className="flex flex-col gap-8 lg:flex-row lg:items-start">
					<Skeleton className="h-9 w-24 lg:hidden" />
					<div className="hidden lg:flex lg:w-64 lg:shrink-0 lg:flex-col lg:gap-6">
						<Skeleton className="h-7 w-20" />
						<Skeleton className="h-32 w-full" />
						<Skeleton className="h-14 w-full" />
						<Skeleton className="h-14 w-full" />
						<Skeleton className="h-14 w-full" />
					</div>
					<div className="flex min-w-0 flex-1 flex-col gap-6">
						<div className="flex flex-wrap items-center justify-between gap-4">
							<Skeleton className="h-5 w-24" />
							<RecipeSortFormSkeleton />
						</div>
						<RecipeSearchResultList>
							{Array.from({ length: skeletonResultCount }, (_, index) => (
								<li key={index}>
									<RecipeSearchResultSkeleton />
								</li>
							))}
						</RecipeSearchResultList>
					</div>
				</div>
			</div>
		</div>
	);
}

export { RecipeSearch, RecipeSearchCloseMatches, RecipeSearchSkeleton };
