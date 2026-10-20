import type { RecipeSearchFacets } from '@/application/ports/recipe-search';
import { Specimen } from '@/components/design-reference/reference-section';
import {
	sampleCatalogFacets,
	sampleGlutenFreeDessertsPage,
} from '@/components/design-reference/sample-recipe-dtos';
import { recipeChapterRows } from '@/components/search/recipe-chapter-rows';
import { RecipeChapterPicker, RecipeChaptersNav } from '@/components/search/recipe-chapters';
import {
	recipesView,
	recipesViewName,
	type RecipeSearchState,
} from '@/components/search/search-params';

type ChapterCounts = Pick<RecipeSearchFacets, 'allRecipes' | 'chapters'>;

const chapterSamples: readonly {
	label: string;
	id: string;
	state: RecipeSearchState;
	counts: ChapterCounts;
}[] = [
	{
		label: 'All Recipes, over every sample recipe',
		id: 'design-chapters-all',
		state: recipesView(),
		counts: sampleCatalogFacets,
	},
	{
		label: 'Desserts, filtered by gluten-free, with five chapters that have none',
		id: 'design-chapters-desserts',
		state: { ...recipesView('desserts'), diets: ['gluten-free'] },
		counts: sampleGlutenFreeDessertsPage.facets,
	},
];

// Each sample laid out as the page lays it: the sidebar's list beside the heading.
function RecipeChaptersSpecimen() {
	return (
		<div className="flex flex-col gap-6">
			{chapterSamples.map(({ label, id, state, counts }) => {
				const rows = recipeChapterRows(state, counts);
				return (
					<Specimen
						key={id}
						label={label}
						className="flex flex-col gap-8 lg:flex-row lg:items-start"
					>
						<div className="lg:w-64 lg:shrink-0">
							<RecipeChaptersNav rows={rows} headingTag="h4" />
						</div>
						<RecipeChapterPicker
							id={id}
							heading={recipesViewName(state).heading}
							rows={Promise.resolve(rows)}
							headingTag="h4"
						/>
					</Specimen>
				);
			})}
		</div>
	);
}

export { RecipeChaptersSpecimen };
