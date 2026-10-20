import { Specimen } from '@/components/design-reference/reference-section';
import {
	sampleContributor,
	sampleSearchPage,
} from '@/components/design-reference/sample-recipe-dtos';
import { SampleRecipeFilterSheet } from '@/components/design-reference/sample-recipe-filter-sheet';
import {
	recipeFilterCarriedParams,
	recipeFilterGroups,
} from '@/components/search/recipe-filter-groups';
import {
	appliedFilterCount,
	recipesViewName,
	type RecipeSearchState,
} from '@/components/search/search-params';

// The search the sample search page shows: butter among vegetarian recipes one member added.
const butterSearch: RecipeSearchState = {
	text: 'butter',
	holidays: [],
	diets: ['vegetarian'],
	contributorId: sampleContributor.id,
	sort: 'relevance',
	page: 1,
};

const headingId = 'design-filter-sheet-heading';

// Its own heading stands in for the page's h1, which takes focus once Show applies.
function RecipeFilterSheetSpecimen() {
	return (
		<Specimen
			label="A search for butter among vegetarian recipes one member added"
			className="flex flex-col items-start gap-6"
		>
			<h4 id={headingId} tabIndex={-1} className="font-heading text-2xl font-semibold">
				{recipesViewName(butterSearch).heading}
			</h4>
			<SampleRecipeFilterSheet
				groups={recipeFilterGroups(butterSearch, sampleSearchPage.facets)}
				tally={{ total: sampleSearchPage.total, counts: sampleSearchPage.facets }}
				carriedParams={recipeFilterCarriedParams(butterSearch)}
				appliedCount={appliedFilterCount(butterSearch)}
				headingId={headingId}
			/>
		</Specimen>
	);
}

export { RecipeFilterSheetSpecimen };
