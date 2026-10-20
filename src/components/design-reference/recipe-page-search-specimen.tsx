import { Specimen } from '@/components/design-reference/reference-section';
import { RecipePageSearch } from '@/components/search/recipe-page-search';
import { recipesView, type RecipeSearchState } from '@/components/search/search-params';

const pageSearchSamples: readonly { label: string; id: string; state: RecipeSearchState }[] = [
	{ label: 'All Recipes', id: 'design-page-search-all', state: recipesView() },
	{
		label: 'Desserts, filtered by Christmas',
		id: 'design-page-search-filtered',
		state: { ...recipesView('desserts'), holidays: ['christmas'] },
	},
	{
		label: 'Soups & Salads, searched for tomato',
		id: 'design-page-search-words',
		state: { ...recipesView('soups-salads'), text: 'tomato', sort: 'relevance' },
	},
];

function RecipePageSearchSpecimen() {
	return (
		<div className="flex flex-col gap-6">
			{pageSearchSamples.map(({ label, id, state }) => (
				<Specimen key={id} label={label}>
					<RecipePageSearch id={id} state={state} />
				</Specimen>
			))}
		</div>
	);
}

export { RecipePageSearchSpecimen };
