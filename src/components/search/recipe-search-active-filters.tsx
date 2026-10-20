import { SearchIcon, XIcon } from 'lucide-react';
import Link from 'next/link';
import type { RecipeSearchFacets } from '@/application/ports/recipe-search';
import {
	addedWithinLabels,
	chosenContributor,
	totalTimeLabels,
} from '@/components/search/recipe-search-filters';
import {
	appliedFilterCount,
	recipeSearchHref,
	withoutFilters,
	withoutText,
	type RecipeSearchState,
} from '@/components/search/search-params';
import { buttonVariants } from '@/components/ui/button';
import { chapterLabels } from '@/domain/recipe/chapter';
import { dietLabels } from '@/domain/recipe/diet';
import { holidayLabels } from '@/domain/recipe/holiday';

type ActiveFilter = {
	key: string;
	// The words, which the search icon marks, or a filter.
	kind: 'words' | 'filter';
	label: string;
	// The same list without it.
	href: string;
};

// The words first, then the chapter, each holiday and diet in the vocabulary's order, and the other
// filters.
function activeFilters(state: RecipeSearchState, facets: RecipeSearchFacets): ActiveFilter[] {
	const without = (change: Partial<RecipeSearchState>) =>
		recipeSearchHref({ ...state, ...change, page: 1 });

	const filters: ActiveFilter[] = [];
	if (state.text !== undefined) {
		filters.push({
			key: 'text',
			kind: 'words',
			label: `“${state.text}”`,
			href: recipeSearchHref(withoutText(state)),
		});
	}
	if (state.chapter !== undefined) {
		filters.push({
			key: 'chapter',
			kind: 'filter',
			label: chapterLabels[state.chapter],
			href: without({ chapter: undefined }),
		});
	}
	for (const holiday of state.holidays) {
		filters.push({
			key: `holiday-${holiday}`,
			kind: 'filter',
			label: holidayLabels[holiday],
			href: without({ holidays: state.holidays.filter((other) => other !== holiday) }),
		});
	}
	for (const diet of state.diets) {
		filters.push({
			key: `diet-${diet}`,
			kind: 'filter',
			label: dietLabels[diet],
			href: without({ diets: state.diets.filter((other) => other !== diet) }),
		});
	}
	if (state.source !== undefined) {
		filters.push({
			key: 'source',
			kind: 'filter',
			label: `From ${state.source}`,
			href: without({ source: undefined }),
		});
	}
	const contributor = chosenContributor(state, facets.contributors);
	if (contributor !== undefined) {
		filters.push({
			key: 'contributor',
			kind: 'filter',
			label: `Added by ${contributor.displayName}`,
			href: without({ contributorId: undefined }),
		});
	}
	if (state.maxTotalMinutes !== undefined) {
		filters.push({
			key: 'time',
			kind: 'filter',
			label: totalTimeLabels[state.maxTotalMinutes],
			href: without({ maxTotalMinutes: undefined }),
		});
	}
	if (state.addedWithin !== undefined) {
		filters.push({
			key: 'added',
			kind: 'filter',
			label: addedWithinLabels[state.addedWithin],
			href: without({ addedWithin: undefined }),
		});
	}
	return filters;
}

// Each chip is an inked pill that removes itself; removing the words returns to Browse with the
// filters. Clear filters keeps the words and the order.
function RecipeSearchActiveFilters({
	state,
	facets,
}: {
	state: RecipeSearchState;
	facets: RecipeSearchFacets;
}) {
	const filters = activeFilters(state, facets);
	if (filters.length === 0) {
		return null;
	}

	return (
		<div className="flex flex-wrap items-center gap-2">
			<ul role="list" aria-label="Active filters" className="flex flex-wrap gap-2">
				{filters.map((filter) => (
					<li key={filter.key}>
						<Link
							href={filter.href}
							className={buttonVariants({
								variant: 'default',
								size: 'sm',
								wrap: true,
								className: 'rounded-full',
							})}
						>
							{filter.kind === 'words' && (
								<SearchIcon data-icon="inline-start" aria-hidden="true" />
							)}
							<span className="sr-only">Remove </span>
							{filter.label}
							<XIcon data-icon="inline-end" aria-hidden="true" />
						</Link>
					</li>
				))}
			</ul>
			{appliedFilterCount(state) > 0 && (
				<Link
					href={recipeSearchHref(withoutFilters(state))}
					className={buttonVariants({ variant: 'ghost', size: 'sm' })}
				>
					Clear filters
				</Link>
			)}
		</div>
	);
}

export { RecipeSearchActiveFilters };
