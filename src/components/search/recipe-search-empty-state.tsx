import Link from 'next/link';
import { Mascot } from '@/components/brand/mascot';
import { RecipesEmptyState } from '@/components/recipe/recipes-empty-state';
import {
	appliedFilterCount,
	recipeSearchHref,
	withoutFilters,
	type RecipeSearchState,
} from '@/components/search/search-params';
import { buttonVariants } from '@/components/ui/button';
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '@/components/ui/empty';

const queryAdvice = 'Check the spelling, or try a shorter or more general search.';
const filterAdvice = 'Remove a filter, or clear them all to see more recipes.';

// Says whether the query, the filters, or both found nothing, and how to widen the search.
function RecipeSearchEmptyState({ state }: { state: RecipeSearchState }) {
	const hasFilters = appliedFilterCount(state) > 0;
	if (state.text === undefined && !hasFilters) {
		return <RecipesEmptyState />;
	}

	const title =
		state.text === undefined
			? 'No recipes match these filters'
			: `No recipes match “${state.text}”${hasFilters ? ' with these filters' : ''}`;
	const advice = [
		...(state.text === undefined ? [] : [queryAdvice]),
		...(hasFilters ? [filterAdvice] : []),
	];

	return (
		<Empty className="border">
			<EmptyHeader>
				<EmptyMedia>
					<Mascot pose="sleeping" size="lg" />
				</EmptyMedia>
				<EmptyTitle>{title}</EmptyTitle>
				<EmptyDescription>{advice.join(' ')}</EmptyDescription>
			</EmptyHeader>
			{hasFilters && (
				<EmptyContent>
					<Link href={recipeSearchHref(withoutFilters(state))} className={buttonVariants()}>
						Clear filters
					</Link>
				</EmptyContent>
			)}
		</Empty>
	);
}

export { RecipeSearchEmptyState };
