import { ReferenceSubsection, Specimen } from '@/components/design-reference/reference-section';
import {
	sampleCatalogFacets,
	sampleContributor,
	sampleRecipeDetail,
	sampleRecipeSummaries,
	sampleSearchPage,
} from '@/components/design-reference/sample-recipe-dtos';
import { SampleRecipeForm } from '@/components/design-reference/sample-recipe-form';
import { PageContainer } from '@/components/layout/page-container';
import type { EditedRecipe } from '@/components/recipe-form/recipe-form-fields';
import {
	recipeFormValues,
	type RecipeFormValues,
} from '@/components/recipe-form/recipe-form-values';
import { RecipeCard } from '@/components/recipe/recipe-card';
import { RecipeDetail } from '@/components/recipe/recipe-detail';
import { RecipeGrid, RecipeGridSkeleton } from '@/components/recipe/recipe-grid';
import { RecipePagination } from '@/components/recipe/recipe-pagination';
import { RecipesEmptyState } from '@/components/recipe/recipes-empty-state';
import { HeaderSearchForm, HeaderSearchLink } from '@/components/search/header-search-bar';
import {
	RecipeSearch,
	RecipeSearchCloseMatches,
	RecipeSearchSkeleton,
} from '@/components/search/recipe-search';
import { RecipeSearchEmptyState } from '@/components/search/recipe-search-empty-state';
import {
	RecipeSearchFiltersDisclosure,
	RecipeSearchFiltersSidebar,
} from '@/components/search/recipe-search-filters';
import type { RecipeSearchState } from '@/components/search/search-params';
import type { Problem } from '@/domain/problem';
import { parseRecipeContent } from '@/domain/recipe/recipe';
import type { RecipeDraftContent } from '@/domain/recipe/recipe-draft';
import { sampleSundayPotRoast } from '@/domain/recipe/samples/sample-recipes';

const sampleSearchState: RecipeSearchState = {
	text: 'butter',
	tags: ['Baking'],
	contributorId: sampleContributor.id,
	sort: 'relevance',
	page: 1,
};

// A tag past the first eight, which shows because it is checked.
const sampleCatalogState: RecipeSearchState = {
	tags: ['Comfort food'],
	sort: 'newest',
	page: 1,
};

const noResultStates: readonly { label: string; state: RecipeSearchState }[] = [
	{
		label: 'A query',
		state: { text: 'biscuts', tags: [], sort: 'relevance', page: 1 },
	},
	{
		label: 'Filters',
		state: { tags: ['Holiday', 'Soup'], sort: 'newest', page: 1 },
	},
	{
		label: 'A query with filters',
		state: { text: 'biscuts', tags: ['Holiday'], sort: 'relevance', page: 1 },
	},
];

// Any id and version: the stand-in action never reads them, and they mark the form as editing.
const sampleEditedRecipe: EditedRecipe = {
	id: '0199c7a4-2c3e-7b1a-9f00-000000000001',
	version: '2026-10-12T00:00:00.000Z',
};

// An import as an extractor might hand it over: no title, and a line and a step to check against
// the original.
const sampleDraft: { content: RecipeDraftContent; problems: Problem[] } = {
	content: {
		source: 'Great-aunt Edie',
		yield: { kind: 'makes', amount: { min: 16 }, unit: 'bars' },
		times: { prepMinutes: 20, cookMinutes: 45 },
		ingredientSections: [
			{
				heading: 'For the crust',
				lines: [
					{
						text: '1 cup all-purpose flour',
						amount: { min: 1 },
						unit: 'cup',
						item: 'all-purpose flour',
					},
					{
						text: '½ cup butter, softened',
						amount: { min: 0.5 },
						unit: 'cup',
						item: 'butter',
						preparation: 'softened',
					},
				],
			},
			{
				heading: 'For the filling',
				lines: [
					{ text: '2 eggs', amount: { min: 2 }, item: 'eggs' },
					{ text: '1 cup sugar', amount: { min: 1 }, unit: 'cup', item: 'sugar' },
					{ text: '3 tablespoons lemon' },
				],
			},
		],
		instructionSections: [
			{
				steps: [
					{ text: 'Heat the oven to 350°F and press the crust into an 8-inch pan.' },
					{ text: 'Bake 20 minutes, then pour in the filling and bake until set.' },
				],
			},
		],
		tags: ['Dessert'],
	},
	problems: [
		{ path: 'title', message: "Add a title. The original doesn't show one." },
		{
			path: 'ingredientSections.1.lines.2',
			message: 'Check this line against the original. Part of it was hard to read.',
		},
		{
			path: 'instructionSections.0.steps.1',
			message: 'Check this step against the original. Part of it was hard to read.',
		},
	],
};

// The recipe form's starting values, as its pages build them.
const recipeFormSamples: readonly {
	label: string;
	initial: RecipeFormValues;
	editing?: EditedRecipe;
}[] = [
	{ label: 'Adding a recipe', initial: recipeFormValues() },
	{
		label: 'Editing a recipe whose first section has a heading',
		initial: recipeFormValues(parseRecipeContent(sampleSundayPotRoast)),
		editing: sampleEditedRecipe,
	},
	{
		label: 'Reviewing an import, with its problems marked',
		initial: recipeFormValues(sampleDraft.content, sampleDraft.problems),
	},
];

function CompositionSpecimens() {
	return (
		<div className="flex flex-col gap-16">
			<ReferenceSubsection
				id="recipe-grid"
				title="Recipe grid"
				description="One column on phones, two on tablets, three on desktop. Each card is a single link to its recipe, and a recipe without a photo keeps the photo's box."
			>
				<RecipeGrid>
					{sampleRecipeSummaries.map((recipe) => (
						<li key={recipe.id}>
							<RecipeCard recipe={recipe} />
						</li>
					))}
				</RecipeGrid>
			</ReferenceSubsection>
			<ReferenceSubsection
				id="recipe-grid-loading"
				title="Recipe grid, loading"
				description="Skeletons hold the same layout while recipes load."
			>
				<RecipeGridSkeleton />
			</ReferenceSubsection>
			<ReferenceSubsection
				id="recipe-pagination"
				title="Recipe pagination"
				description="Previous and Next only where they lead somewhere, the first and last pages, and the current page with one on each side. Each page's link comes from the page, so it keeps the rest of the URL, such as the order. Here every link stays on this page."
			>
				<Specimen>
					<RecipePagination page={5} pageCount={10} pageHref={() => '#recipe-pagination'} />
				</Specimen>
			</ReferenceSubsection>
			<ReferenceSubsection
				id="recipe-detail"
				title="Recipe detail"
				description="Reading width, with ingredients and steps in text-lg. Its headings start at h4 here, under this page's own."
			>
				<Specimen className="px-0 py-10 sm:py-14">
					<PageContainer width="reading">
						<RecipeDetail recipe={sampleRecipeDetail} headingLevel={4} />
					</PageContainer>
				</Specimen>
			</ReferenceSubsection>
			<ReferenceSubsection
				id="empty-state"
				title="Empty state"
				description="The home page and search before anyone adds a recipe."
			>
				<RecipesEmptyState />
			</ReferenceSubsection>
			<ReferenceSubsection
				id="search-bar"
				title="Search bar"
				description="In the header, a field from sm that starts a fresh search, and on phones a link to the search page. The search page leaves both off, since it has its own field."
			>
				<div className="grid gap-6 md:grid-cols-2">
					<Specimen label="From sm">
						<HeaderSearchForm id="design-header-search" />
					</Specimen>
					<Specimen label="On phones">
						<HeaderSearchLink />
					</Specimen>
				</div>
			</ReferenceSubsection>
			<ReferenceSubsection
				id="search-results"
				title="Search results"
				description="A search for butter among baking recipes added by one member. Filters sit beside the results from lg and fold into a disclosure below it; they apply with their button, while the order applies on selection. Active filters are links that remove themselves, the count is announced as it changes, and matches are marked. Its headings start at h4 here."
			>
				<Specimen>
					<RecipeSearch
						state={sampleSearchState}
						results={sampleSearchPage}
						pageCount={1}
						headingLevel={4}
					/>
				</Specimen>
				<div className="grid gap-6 md:grid-cols-2">
					<Specimen label="Below lg: the filters in a disclosure, over every sample recipe">
						<RecipeSearchFiltersDisclosure
							idPrefix="design-filters-disclosure"
							state={sampleCatalogState}
							facets={sampleCatalogFacets}
							headingTag="h4"
						/>
					</Specimen>
					<Specimen label="From lg: the filters in a sidebar, over every sample recipe">
						<RecipeSearchFiltersSidebar
							idPrefix="design-filters-sidebar"
							state={sampleCatalogState}
							facets={sampleCatalogFacets}
							headingTag="h4"
						/>
					</Specimen>
				</div>
				<Specimen label="When nothing matches exactly">
					<RecipeSearchCloseMatches text="chiken soup" />
				</Specimen>
			</ReferenceSubsection>
			<ReferenceSubsection
				id="search-results-loading"
				title="Search results, loading"
				description="Skeletons hold the same layout while results load."
			>
				<RecipeSearchSkeleton />
			</ReferenceSubsection>
			<ReferenceSubsection
				id="search-no-results"
				title="No results"
				description="Each says what found nothing and how to widen the search. A search of an empty catalog shows the empty state instead."
			>
				<div className="grid gap-6 lg:grid-cols-3">
					{noResultStates.map(({ label, state }) => (
						<Specimen key={label} label={label} frame="bare">
							<RecipeSearchEmptyState state={state} />
						</Specimen>
					))}
				</div>
			</ReferenceSubsection>
			<ReferenceSubsection
				id="recipe-form"
				title="Recipe form"
				description="For adding and editing a recipe, and for reviewing an import. Ingredients and steps are lists of growing fields in sections, and each item's menu moves or removes it; each ingredient shows how it will read. Chosen photos are resized and upload at once. Here uploads are simulated, and saving checks the recipe as the site does but saves nothing."
			>
				{recipeFormSamples.map(({ label, initial, editing }) => (
					<Specimen key={label} label={label} className="px-0 py-10 sm:py-14">
						<PageContainer width="reading">
							<SampleRecipeForm initial={initial} editing={editing} />
						</PageContainer>
					</Specimen>
				))}
			</ReferenceSubsection>
		</div>
	);
}

export { CompositionSpecimens };
