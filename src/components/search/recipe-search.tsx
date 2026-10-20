import { cn } from 'cn';
import type * as React from 'react';
import type { RecipeSearchSort } from '@/application/ports/recipe-search';
import type { RecipeSearchPage } from '@/application/search/recipe-search-dtos';
import { BackLink } from '@/components/layout/back-link';
import { RecipeGrid, RecipeGridSkeletonItems } from '@/components/recipe/recipe-grid';
import { RecipePagination } from '@/components/recipe/recipe-pagination';
import { backToAllRecipesLabel } from '@/components/recipe/recipe-paths';
import { FilterChangeFocus } from '@/components/search/filter-change-focus';
import {
	RecipeChapterPicker,
	RecipeChaptersNav,
	type RecipeChapterRow,
} from '@/components/search/recipe-chapters';
import { recipeCount } from '@/components/search/recipe-count';
import { RecipeFilterSidebar } from '@/components/search/recipe-filter-form';
import {
	recipeFilterCarriedParams,
	recipeFilterGroups,
} from '@/components/search/recipe-filter-groups';
import { RecipeFilterSheet } from '@/components/search/recipe-filter-sheet';
import { RecipePageSearch } from '@/components/search/recipe-page-search';
import { RecipeResultsLoading } from '@/components/search/recipe-results-loading';
import { RecipeSearchActiveFilters } from '@/components/search/recipe-search-active-filters';
import { RecipeSearchEmptyState } from '@/components/search/recipe-search-empty-state';
import {
	appliedFilterCount,
	recipeSearchFiltersKey,
	recipeSearchHref,
	recipesViewName,
	withoutChapter,
	withoutFilters,
	type RecipeSearchState,
} from '@/components/search/search-params';
import { Skeleton } from '@/components/ui/skeleton';
import { chapters } from '@/domain/recipe/chapter';

// Keyed by the view's heading: the page's h1, or h4 nesting the page under the design reference's own
// headings. The sidebar's sections and the results' hidden heading take the next level, so a recipe's
// title sits below them rather than beside them.
const recipesHeadingTags = {
	h1: { section: 'h2', item: 'h3' },
	h4: { section: 'h4', item: 'h5' },
} as const;

type RecipesHeadingTag = keyof typeof recipesHeadingTags;

// From lg the sidebar takes the left column, beside both the view's header and its results, which
// follow the header in reading order so the h1 comes first. Below lg one column, with no sidebar. The
// results keep their own height where the sidebar is taller, so an empty result's box stays small.
const gridClassName =
	'flex flex-col gap-6 lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:grid-rows-[auto_1fr] lg:gap-x-8';
const headerPlaceClassName = 'lg:col-start-2 lg:row-start-1';
const sidebarPlaceClassName = 'hidden lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:flex';
const resultsPlaceClassName = 'lg:col-start-2 lg:row-start-2 lg:self-start';

// Each page's ids, begun by its prefix, so each Recipes page the design reference shows keeps its own.
function recipesIds(idPrefix: string) {
	return {
		// The view's heading, which takes focus as the list changes.
		heading: `${idPrefix}-heading`,
		search: `${idPrefix}-search`,
		results: `${idPrefix}-results-heading`,
		filteredBy: `${idPrefix}-filtered-by`,
	};
}

// The Recipes page's own ids, whose heading the header's search focuses once its results show.
const recipesPageIdPrefix = 'recipes';
const recipesPageIds = recipesIds(recipesPageIdPrefix);

const sortDescriptions: Record<RecipeSearchSort, string> = {
	relevance: 'best match first',
	newest: 'newest first',
	title: 'A to Z',
};

// The Recipes page's grid, which holds the view's header and its results.
function RecipesPageGrid({ children }: { children: React.ReactNode }) {
	return <div className={gridClassName}>{children}</div>;
}

type RecipesViewHeaderProps = {
	idPrefix: string;
	state: RecipeSearchState;
	// The chapter list's rows, which the heading's sheet shows below lg once the view's counts are read.
	chapterRows: Promise<readonly RecipeChapterRow[]>;
	headingTag?: RecipesHeadingTag;
};

// What names the view and searches it: in a chapter the link back to All Recipes, which keeps the
// words and the filters; the heading, which chooses a chapter below lg; and the page's search box.
// It needs only the URL, so it shows before the results are read.
function RecipesViewHeader({
	idPrefix,
	state,
	chapterRows,
	headingTag = 'h1',
}: RecipesViewHeaderProps) {
	const ids = recipesIds(idPrefix);

	return (
		<div className={cn('flex flex-col gap-6', headerPlaceClassName)}>
			<div className="flex flex-col">
				{state.chapter !== undefined && (
					<BackLink href={recipeSearchHref(withoutChapter(state))} className="mb-6">
						{backToAllRecipesLabel}
					</BackLink>
				)}
				<RecipeChapterPicker
					id={ids.heading}
					heading={recipesViewName(state).heading}
					rows={chapterRows}
					headingTag={headingTag}
				/>
			</div>
			<RecipePageSearch id={ids.search} state={state} />
		</div>
	);
}

function RecipesViewHeaderSkeleton() {
	return (
		<div aria-hidden="true" className={cn('flex flex-col gap-6', headerPlaceClassName)}>
			<RecipeResultsLoading />
			<Skeleton className="h-10 w-56" />
			<div className="flex flex-col gap-3">
				<Skeleton className="h-5 w-36" />
				<Skeleton className="h-11 w-full" />
			</div>
		</div>
	);
}

function RecipeSearchCloseMatches({ text }: { text: string }) {
	return <p className="text-sm">No exact matches for “{text}”. Showing close matches.</p>;
}

type RecipeSearchProps = {
	idPrefix: string;
	state: RecipeSearchState;
	results: RecipeSearchPage;
	pageCount: number;
	// The chapter list's rows, built once for the sidebar and the heading's sheet.
	chapterRows: readonly RecipeChapterRow[];
	headingTag?: RecipesHeadingTag;
};

// The polite status: the count and the order, with the words when searching. Beside an empty result,
// whose message says why, it is for screen readers only. They also hear close matches and the page,
// which the notice and the pagination show.
function RecipeCountLine({
	state,
	results,
	pageCount,
}: Pick<RecipeSearchProps, 'state' | 'results' | 'pageCount'>) {
	const matching = state.text === undefined ? '' : ` matching “${state.text}”`;

	return (
		// Outside any keyed subtree, so it stays in place and each new count is announced.
		<p
			role="status"
			aria-live="polite"
			className={results.total === 0 ? 'sr-only' : 'text-sm text-muted-foreground'}
		>
			{results.total === 0 ? (
				`No recipes${matching}`
			) : (
				<>
					{recipeCount(results.total)}
					{matching}
					{results.match === 'close' && <span className="sr-only">, close matches</span>}
					{`, ${sortDescriptions[state.sort]}`}
					{pageCount > 1 && (
						<span className="sr-only">{`, page ${state.page} of ${pageCount}`}</span>
					)}
				</>
			)}
		</p>
	);
}

// The view's results beside the sidebar's chapters and Filter and sort from lg. Below lg, Filter and
// sort opens in a sheet and the heading chooses a chapter. Above the recipes, the filters applied as
// chips and the count line; below them, the pages. Focus moves to the view's heading as a link here
// changes the list and takes focus with it.
function RecipeSearch({
	idPrefix,
	state,
	results,
	pageCount,
	chapterRows,
	headingTag = 'h1',
}: RecipeSearchProps) {
	const ids = recipesIds(idPrefix);
	const { section: Section, item: itemHeadingTag } = recipesHeadingTags[headingTag];
	const groups = recipeFilterGroups(state, results.facets);
	const carriedParams = recipeFilterCarriedParams(state);
	const filterCount = appliedFilterCount(state);
	const { backLabel } = recipesViewName(state);

	return (
		<>
			<div className={cn('flex-col gap-10', sidebarPlaceClassName)}>
				<RecipeChaptersNav rows={chapterRows} headingTag={Section} />
				<RecipeFilterSidebar
					groups={groups}
					carriedParams={carriedParams}
					clearAllHref={filterCount > 0 ? recipeSearchHref(withoutFilters(state)) : undefined}
					headingTag={Section}
				/>
			</div>
			<section
				aria-labelledby={ids.results}
				className={cn('flex min-w-0 flex-col gap-6', resultsPlaceClassName)}
			>
				<Section id={ids.results} className="sr-only">
					Recipes
				</Section>
				<FilterChangeFocus
					filtersKey={recipeSearchFiltersKey(state)}
					resultsHeadingId={ids.heading}
				/>
				<div className="flex flex-col gap-3">
					<div className="lg:hidden">
						<RecipeFilterSheet
							groups={groups}
							tally={{ total: results.total, counts: results.facets }}
							carriedParams={carriedParams}
							appliedCount={filterCount}
							headingId={ids.heading}
						/>
					</div>
					<RecipeSearchActiveFilters
						labelId={ids.filteredBy}
						state={state}
						facets={results.facets}
					/>
					<RecipeCountLine state={state} results={results} pageCount={pageCount} />
					{/* A close search the filters empty says so in its empty result. */}
					{results.match === 'close' && results.total > 0 && state.text !== undefined && (
						<RecipeSearchCloseMatches text={state.text} />
					)}
				</div>
				{results.results.length === 0 ? (
					<RecipeSearchEmptyState state={state} />
				) : (
					<RecipeGrid
						layout="besideSidebar"
						entries={results.results.map(({ recipe, title, snippet }) => ({
							recipe,
							highlights: state.text === undefined ? undefined : { title, snippet },
						}))}
						namesChapter={state.chapter === undefined}
						headingTag={itemHeadingTag}
						backLabel={backLabel}
					/>
				)}
				{pageCount > 1 && (
					<RecipePagination
						page={state.page}
						pageCount={pageCount}
						pageHref={(page) => recipeSearchHref({ ...state, page })}
						resultsHeadingId={ids.heading}
					/>
				)}
			</section>
		</>
	);
}

// The sidebar's chapters and filters from lg, and the rows or cards, while the view is read.
function RecipeSearchSkeleton() {
	return (
		<>
			<RecipeResultsLoading />
			<div aria-hidden="true" className={cn('flex-col gap-10', sidebarPlaceClassName)}>
				<div className="flex flex-col gap-3">
					<Skeleton className="h-7 w-28" />
					{/* All Recipes and each chapter. */}
					{Array.from({ length: chapters.length + 1 }, (_, index) => (
						<Skeleton key={index} className="h-8 w-full" />
					))}
				</div>
				<div className="flex flex-col gap-5">
					<Skeleton className="h-7 w-36" />
					<Skeleton className="h-24 w-full" />
					<Skeleton className="h-48 w-full" />
				</div>
			</div>
			<div
				role="status"
				aria-live="polite"
				className={cn('flex min-w-0 flex-col gap-6', resultsPlaceClassName)}
			>
				<span className="sr-only">Loading recipes</span>
				<div aria-hidden="true" className="flex flex-col gap-3">
					<Skeleton className="h-10 w-40 lg:hidden" />
					<Skeleton className="h-5 w-48" />
				</div>
				<div aria-hidden="true">
					<RecipeGridSkeletonItems layout="besideSidebar" />
				</div>
			</div>
		</>
	);
}

export {
	RecipeSearch,
	RecipeSearchCloseMatches,
	RecipeSearchSkeleton,
	RecipesPageGrid,
	recipesPageIdPrefix,
	recipesPageIds,
	RecipesViewHeader,
	RecipesViewHeaderSkeleton,
};
