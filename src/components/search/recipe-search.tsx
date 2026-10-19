import type { RecipeSearchSort } from '@/application/ports/recipe-search';
import type { RecipeSearchPage } from '@/application/search/recipe-search-dtos';
import { RecipeGrid, RecipeGridSkeletonCards } from '@/components/recipe/recipe-grid';
import { RecipePagination } from '@/components/recipe/recipe-pagination';
import { RecipeSortForm, RecipeSortFormSkeleton } from '@/components/recipe/recipe-sort-form';
import { FilterChangeFocus } from '@/components/search/filter-change-focus';
import { recipeSearchHintId } from '@/components/search/header-search-bar';
import { HiddenSearchFields } from '@/components/search/hidden-search-fields';
import { RecipeSearchActiveFilters } from '@/components/search/recipe-search-active-filters';
import { RecipeSearchEmptyState } from '@/components/search/recipe-search-empty-state';
import {
	RecipeSearchFilters,
	RecipeSearchFiltersSidebar,
} from '@/components/search/recipe-search-filters';
import {
	firstResultCount,
	RecipeSearchResult,
	RecipeSearchResultList,
	RecipeSearchResultRows,
	RecipeSearchResultSkeleton,
} from '@/components/search/recipe-search-result';
import { RecipeSearchToolbar } from '@/components/search/recipe-search-toolbar';
import {
	appliedFilterCount,
	recipeSearchFiltersKey,
	recipeSearchHref,
	recipeSearchMode,
	recipeSearchModePath,
	recipeSearchSortsFor,
	type RecipeSearchMode,
	type RecipeSearchState,
} from '@/components/search/search-params';
import { Skeleton } from '@/components/ui/skeleton';

// Keyed by the sections' level; level 4 nests search under the design reference's own headings. Cards
// take the sections' level, and Search's rows the level below its Results heading.
const searchHeadingTags = {
	2: { section: 'h2', result: 'h3' },
	4: { section: 'h4', result: 'h5' },
} as const;

type SearchHeadingLevel = keyof typeof searchHeadingTags;

// The hidden heading over Search's rows, below the page's own heading and hint.
const searchResultsHeadingId = 'search-results-heading';

const loadingLabels: Record<RecipeSearchMode, string> = {
	browse: 'Loading recipes',
	search: 'Loading results',
};

// The label each list records for a recipe's link back to it.
const backLabels: Record<RecipeSearchMode, string> = {
	browse: 'Back to recipes',
	search: 'Back to search results',
};

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

// How to write a query, under the search page's heading.
function RecipeSearchHint() {
	return (
		<p id={recipeSearchHintId} className="text-sm text-muted-foreground">
			Try &quot;brown butter&quot; for an exact phrase, or -nuts to leave nuts out.
		</p>
	);
}

function RecipeSearchCloseMatches({ text }: { text: string }) {
	return <p className="text-sm">No exact matches for “{text}”. Showing close matches.</p>;
}

// One control over two lists: from lg the filters sit in a sidebar, and below lg in the toolbar's
// Filters, beside Browse's cards or Search's rows ranked with the words marked.
function RecipeSearch({
	state,
	results,
	pageCount,
	headingLevel,
	resultsHeadingId: pageResultsHeadingId,
}: {
	state: RecipeSearchState;
	results: RecipeSearchPage;
	pageCount: number;
	headingLevel: SearchHeadingLevel;
	// The page's own heading over the results, as Browse's is; without one, a hidden Results heading
	// heads them. Focus moves to it as the results change.
	resultsHeadingId?: string;
}) {
	const mode = recipeSearchMode(state);
	const { section: Section, result: resultHeadingTag } = searchHeadingTags[headingLevel];
	const resultsHeadingId = pageResultsHeadingId ?? searchResultsHeadingId;

	return (
		<div className="flex flex-col gap-8 lg:flex-row lg:items-start">
			<RecipeSearchFiltersSidebar
				idPrefix={`${mode}-filters-sidebar`}
				state={state}
				facets={results.facets}
				total={results.total}
				headingTag={Section}
				className="hidden lg:flex lg:w-64 lg:shrink-0"
			/>
			<section aria-labelledby={resultsHeadingId} className="flex min-w-0 flex-1 flex-col gap-6">
				{pageResultsHeadingId === undefined && (
					<Section id={resultsHeadingId} tabIndex={-1} className="sr-only">
						Results
					</Section>
				)}
				<FilterChangeFocus
					filtersKey={recipeSearchFiltersKey(state)}
					resultsHeadingId={resultsHeadingId}
				/>
				<RecipeSearchToolbar
					appliedFilterCount={appliedFilterCount(state)}
					resultsHeadingId={resultsHeadingId}
					count={
						// Outside any keyed subtree, so it stays in place and each new count is announced.
						<p role="status" aria-live="polite" className="text-sm text-muted-foreground">
							{recipeCount(results.total)}
							<span className="sr-only">{resultsDescription(state, results, pageCount)}</span>
						</p>
					}
					sort={
						results.total > 0 ? (
							<RecipeSortForm
								id={`${mode}-sort`}
								action={recipeSearchModePath(state)}
								sorts={recipeSearchSortsFor(state.text)}
								value={state.sort}
								compact
							>
								<HiddenSearchFields state={state} editedFields={['sort']} />
							</RecipeSortForm>
						) : undefined
					}
					filters={
						<RecipeSearchFilters
							idPrefix={`${mode}-filters-panel`}
							state={state}
							facets={results.facets}
							total={results.total}
						/>
					}
				/>
				<RecipeSearchActiveFilters state={state} facets={results.facets} />
				{results.match === 'close' && state.text !== undefined && (
					<RecipeSearchCloseMatches text={state.text} />
				)}
				{results.results.length === 0 ? (
					<RecipeSearchEmptyState state={state} />
				) : mode === 'browse' ? (
					<RecipeGrid
						layout="besideSidebar"
						recipes={results.results.map(({ recipe }) => recipe)}
						headingTag={Section}
						backLabel={backLabels[mode]}
					/>
				) : (
					<RecipeSearchResultList backLabel={backLabels[mode]}>
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
				)}
				{pageCount > 1 && (
					<RecipePagination
						page={state.page}
						pageCount={pageCount}
						pageHref={(page) => recipeSearchHref({ ...state, page })}
						resultsHeadingId={resultsHeadingId}
					/>
				)}
			</section>
		</div>
	);
}

// Browse's cards or Search's rows beside the sidebar's place.
function RecipeSearchSkeleton({ mode }: { mode: RecipeSearchMode }) {
	return (
		<div role="status" aria-live="polite">
			<span className="sr-only">{loadingLabels[mode]}</span>
			<div aria-hidden="true" className="flex flex-col gap-8 lg:flex-row lg:items-start">
				<div className="hidden lg:flex lg:w-64 lg:shrink-0 lg:flex-col lg:gap-6">
					<Skeleton className="h-7 w-20" />
					<Skeleton className="h-32 w-full" />
					<Skeleton className="h-14 w-full" />
					<Skeleton className="h-14 w-full" />
					<Skeleton className="h-14 w-full" />
					<Skeleton className="h-14 w-full" />
				</div>
				<div className="flex min-w-0 flex-1 flex-col gap-6">
					<div className="flex flex-wrap items-center justify-between gap-4">
						<Skeleton className="h-9 w-24 lg:hidden" />
						<div className="max-lg:order-last max-lg:basis-full">
							<Skeleton className="h-5 w-24" />
						</div>
						<RecipeSortFormSkeleton compact />
					</div>
					{mode === 'browse' ? (
						<RecipeGridSkeletonCards layout="besideSidebar" />
					) : (
						<RecipeSearchResultRows>
							{Array.from({ length: skeletonResultCount }, (_, index) => (
								<li key={index}>
									<RecipeSearchResultSkeleton />
								</li>
							))}
						</RecipeSearchResultRows>
					)}
				</div>
			</div>
		</div>
	);
}

export { RecipeSearch, RecipeSearchCloseMatches, RecipeSearchHint, RecipeSearchSkeleton };
