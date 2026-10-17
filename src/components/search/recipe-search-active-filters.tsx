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
import { tagKey } from '@/domain/recipe/tag-normalization';

type ActiveFilter = {
	key: string;
	// The words, which the search icon marks, or a filter.
	kind: 'words' | 'filter';
	label: string;
	// The same list without it.
	href: string;
};

// The words first, then each tag in the URL's order, then the other filters.
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
	for (const tag of state.tags) {
		filters.push({
			key: `tag-${tagKey(tag)}`,
			kind: 'filter',
			label: tag,
			href: without({ tags: state.tags.filter((other) => tagKey(other) !== tagKey(tag)) }),
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
