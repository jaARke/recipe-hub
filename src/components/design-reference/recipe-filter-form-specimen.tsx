import { Specimen } from '@/components/design-reference/reference-section';
import { sampleCatalogFacets } from '@/components/design-reference/sample-recipe-dtos';
import { RecipeFilterSidebar } from '@/components/search/recipe-filter-form';
import {
	recipeFilterCarriedParams,
	recipeFilterGroups,
} from '@/components/search/recipe-filter-groups';
import {
	appliedFilterCount,
	recipeSearchHref,
	recipesView,
	withoutFilters,
	type RecipeSearchState,
} from '@/components/search/search-params';

// Each over every sample recipe's counts.
const filterFormSamples: readonly { label: string; state: RecipeSearchState }[] = [
	{ label: 'All Recipes, with nothing applied', state: recipesView() },
	{
		label: 'Desserts, filtered by Christmas and a name inside the fold',
		state: { ...recipesView('desserts'), holidays: ['christmas'], source: 'Tante Hélène' },
	},
];

function RecipeFilterFormSpecimen() {
	return (
		<div className="grid gap-6 md:grid-cols-2">
			{filterFormSamples.map(({ label, state }) => (
				<Specimen key={label} label={label}>
					{/* As wide as the page's sidebar. */}
					<div className="max-w-64">
						<RecipeFilterSidebar
							groups={recipeFilterGroups(state, sampleCatalogFacets)}
							carriedParams={recipeFilterCarriedParams(state)}
							clearAllHref={
								appliedFilterCount(state) > 0 ? recipeSearchHref(withoutFilters(state)) : undefined
							}
							headingTag="h4"
						/>
					</div>
				</Specimen>
			))}
		</div>
	);
}

export { RecipeFilterFormSpecimen };
