import type { RecipeSearchSort } from '@/application/ports/recipe-search';
import type { RecipeSearchPage } from '@/application/search/recipe-search-dtos';
import { RecipePagination } from '@/components/recipe/recipe-pagination';
import { recipeSearchPath } from '@/components/recipe/recipe-paths';
import { RecipeSortForm, RecipeSortFormSkeleton } from '@/components/recipe/recipe-sort-form';
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
	RecipeSearchResultSkeleton,
} from '@/components/search/recipe-search-result';
import { RecipeSearchToolbar } from '@/components/search/recipe-search-toolbar';
import {
	appliedFilterCount,
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

// The header's field on the search page is described by the hint.
const recipeSearchHintId = 'search-hint';

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
		<div className="flex flex-col gap-8 lg:flex-row lg:items-start">
			<RecipeSearchFiltersSidebar
				idPrefix="search-filters-sidebar"
				state={state}
				facets={results.facets}
				headingTag={Section}
				className="hidden lg:flex lg:w-64 lg:shrink-0"
			/>
			<section aria-labelledby={resultsHeadingId} className="flex min-w-0 flex-1 flex-col gap-6">
				<Section id={resultsHeadingId} tabIndex={-1} className="sr-only">
					Results
				</Section>
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
								id="search-sort"
								action={recipeSearchPath}
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
							idPrefix="search-filters-panel"
							state={state}
							facets={results.facets}
						/>
					}
				/>
				<RecipeSearchActiveFilters state={state} facets={results.facets} />
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
						resultsHeadingId={resultsHeadingId}
					/>
				)}
			</section>
		</div>
	);
}

function RecipeSearchSkeleton() {
	return (
		<div role="status" aria-live="polite">
			<span className="sr-only">Loading results</span>
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
	);
}

export {
	RecipeSearch,
	RecipeSearchCloseMatches,
	RecipeSearchHint,
	recipeSearchHintId,
	RecipeSearchSkeleton,
};
