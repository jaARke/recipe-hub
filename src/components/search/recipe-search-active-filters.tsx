import { XIcon } from 'lucide-react';
import Link from 'next/link';
import type { RecipeSearchFacets } from '@/application/ports/recipe-search';
import {
	addedWithinLabels,
	chosenContributor,
	totalTimeLabels,
} from '@/components/search/recipe-search-filters';
import {
	recipeSearchHref,
	withoutFilters,
	type RecipeSearchState,
} from '@/components/search/search-params';
import { buttonVariants } from '@/components/ui/button';
import { tagKey } from '@/domain/recipe/tag-normalization';

type ActiveFilter = {
	key: string;
	label: string;
	// The same search without this filter.
	href: string;
};

function activeFilters(state: RecipeSearchState, facets: RecipeSearchFacets): ActiveFilter[] {
	const without = (change: Partial<RecipeSearchState>) =>
		recipeSearchHref({ ...state, ...change, page: 1 });

	const filters = state.tags.map((tag) => ({
		key: `tag-${tagKey(tag)}`,
		label: tag,
		href: without({ tags: state.tags.filter((other) => other !== tag) }),
	}));
	if (state.source !== undefined) {
		filters.push({
			key: 'source',
			label: `From ${state.source}`,
			href: without({ source: undefined }),
		});
	}
	const contributor = chosenContributor(state, facets.contributors);
	if (contributor !== undefined) {
		filters.push({
			key: 'contributor',
			label: `Added by ${contributor.displayName}`,
			href: without({ contributorId: undefined }),
		});
	}
	if (state.maxTotalMinutes !== undefined) {
		filters.push({
			key: 'time',
			label: totalTimeLabels[state.maxTotalMinutes],
			href: without({ maxTotalMinutes: undefined }),
		});
	}
	if (state.addedWithin !== undefined) {
		filters.push({
			key: 'added',
			label: addedWithinLabels[state.addedWithin],
			href: without({ addedWithin: undefined }),
		});
	}
	return filters;
}

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
			<ul aria-label="Active filters" className="flex flex-wrap gap-2">
				{filters.map((filter) => (
					<li key={filter.key}>
						<Link
							href={filter.href}
							className={buttonVariants({ variant: 'outline', size: 'sm', wrap: true })}
						>
							<span className="sr-only">Remove </span>
							{filter.label}
							<XIcon data-icon="inline-end" aria-hidden="true" />
						</Link>
					</li>
				))}
			</ul>
			<Link
				href={recipeSearchHref(withoutFilters(state))}
				className={buttonVariants({ variant: 'ghost', size: 'sm' })}
			>
				Clear filters
			</Link>
		</div>
	);
}

export { RecipeSearchActiveFilters };
