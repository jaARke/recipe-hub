import { XIcon } from 'lucide-react';
import Link from 'next/link';
import type { RecipeSearchFacets } from '@/application/ports/recipe-search';
import { appliedRecipeFilters } from '@/components/search/recipe-filter-groups';
import {
	recipeSearchHref,
	withoutFilters,
	type RecipeSearchState,
} from '@/components/search/search-params';
import { buttonVariants } from '@/components/ui/button';

// "Filtered by:" and a chip for each filter the view applies, outlined unlike a recipe's badges, which
// removes it; Clear all, which keeps the words, the chapter, and the order, once there are two. The
// words and the chapter are the view, which the search box and the chapters change.
function RecipeSearchActiveFilters({
	labelId,
	state,
	facets,
}: {
	// The label's, which names the list of chips.
	labelId: string;
	state: RecipeSearchState;
	facets: RecipeSearchFacets;
}) {
	const filters = appliedRecipeFilters(state, facets);
	if (filters.length === 0) {
		return null;
	}

	return (
		<div className="flex flex-wrap items-center gap-2">
			<span id={labelId} className="text-sm font-medium">
				Filtered by:
			</span>
			<ul role="list" aria-labelledby={labelId} className="flex flex-wrap gap-2">
				{filters.map((filter) => (
					<li key={filter.key}>
						<Link
							href={filter.href}
							className={buttonVariants({
								variant: 'outline',
								size: 'sm',
								wrap: true,
								className: 'rounded-full',
							})}
						>
							<span className="sr-only">Remove </span>
							{filter.label}
							<XIcon data-icon="inline-end" aria-hidden="true" />
						</Link>
					</li>
				))}
			</ul>
			{filters.length > 1 && (
				<Link
					href={recipeSearchHref(withoutFilters(state))}
					className={buttonVariants({ variant: 'ghost', size: 'sm' })}
				>
					Clear all
				</Link>
			)}
		</div>
	);
}

export { RecipeSearchActiveFilters };
