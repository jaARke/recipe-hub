import type { UnsavedImportDto } from '@/application/ingestion/recipe-import-dtos';
import {
	ReferenceSubsection,
	ReferenceSubsectionNav,
	Specimen,
} from '@/components/design-reference/reference-section';
import {
	sampleCatalogFacets,
	sampleContributor,
	sampleImportsNow,
	sampleRecipeDetail,
	sampleRecipeSummaries,
	sampleSearchPage,
	sampleUnsavedImports,
} from '@/components/design-reference/sample-recipe-dtos';
import { SampleRecipeForm } from '@/components/design-reference/sample-recipe-form';
import {
	SampleScanImportForm,
	SampleUrlImportForm,
} from '@/components/design-reference/sample-recipe-import';
import { PageContainer } from '@/components/layout/page-container';
import type { EditedRecipe } from '@/components/recipe-form/recipe-form-fields';
import {
	recipeFormValues,
	type RecipeFormValues,
} from '@/components/recipe-form/recipe-form-values';
import { RecipeEntryTabs } from '@/components/recipe-import/recipe-entry-tabs';
import { RecipeImportSubmit } from '@/components/recipe-import/recipe-import-submit';
import { RecipeCard } from '@/components/recipe/recipe-card';
import { RecipeDetail } from '@/components/recipe/recipe-detail';
import { RecipeGrid, RecipeGridSkeleton } from '@/components/recipe/recipe-grid';
import { RecipeEditLink } from '@/components/recipe/recipe-member-view';
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

// Every sample recipe's tags, most used first, as the recipe form suggests them.
const sampleTagLabels = sampleCatalogFacets.tags.map(({ label }) => label);

// Any id and version: the stand-in action never reads them, and they mark the form as editing. No
// other sample recipe is slow cooked, so the pot roast can respell that tag.
const sampleEditedRecipe: EditedRecipe = {
	id: '0199c7a4-2c3e-7b1a-9f00-000000000001',
	version: '2026-10-12T00:00:00.000Z',
	respellableTags: ['Slow cooked'],
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
		{ path: 'title', message: 'Add a title. The original doesn’t show one.' },
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

// The entry tabs with the member's drafts, and with none, whose tab then shows no count.
const entryDraftSamples: readonly { label: string; imports: readonly UnsavedImportDto[] }[] = [
	{ label: 'With drafts', imports: sampleUnsavedImports },
	{ label: 'With no drafts', imports: [] },
];

// One entry per composition, browsing first and contributing last.
const subsections = [
	{
		id: 'recipe-grid',
		title: 'Recipe grid',
		description:
			'One column on phones, two on tablets, three on desktop. Each card is a single link to its recipe, and a recipe without a photo keeps the photo’s box.',
		Content: RecipeGridSpecimen,
	},
	{
		id: 'recipe-grid-loading',
		title: 'Recipe grid, loading',
		description: 'Skeletons hold the same layout while recipes load.',
		Content: RecipeGridSkeleton,
	},
	{
		id: 'recipe-pagination',
		title: 'Recipe pagination',
		description:
			'Previous and Next only where they lead somewhere, the first and last pages, and the current page with one on each side. Each page’s link comes from the page, so it keeps the rest of the URL, such as the order. Here every link stays on this page.',
		Content: RecipePaginationSpecimen,
	},
	{
		id: 'recipe-detail',
		title: 'Recipe detail',
		description:
			'Reading width, with ingredients and steps in text-lg. The cover and the row of other photos each open a viewer of every photo, and the pencil beside the title, for the contributor and admins, opens the edit page. Its headings start at h4 here, under this page’s own.',
		Content: RecipeDetailSpecimen,
	},
	{
		id: 'empty-state',
		title: 'Empty state',
		description: 'The home page and search before anyone adds a recipe.',
		Content: RecipesEmptyState,
	},
	{
		id: 'search-bar',
		title: 'Search bar',
		description:
			'In the header, a field from lg that starts a fresh search, and below lg a link to the search page. The search page leaves both off, since it has its own field.',
		Content: SearchBarSpecimen,
	},
	{
		id: 'search-results',
		title: 'Search results',
		description:
			'A search for butter among baking recipes added by one member. Filters sit beside the results from lg and fold into a disclosure below it; they apply with their button, while the order applies on selection. Active filters are links that remove themselves, the count is announced as it changes, and matches are marked. Its headings start at h4 here.',
		Content: SearchResultsSpecimen,
	},
	{
		id: 'search-results-loading',
		title: 'Search results, loading',
		description: 'Skeletons hold the same layout while results load.',
		Content: RecipeSearchSkeleton,
	},
	{
		id: 'search-no-results',
		title: 'No results',
		description:
			'Each says what found nothing and how to widen the search. A search of an empty catalog shows the empty state instead.',
		Content: NoResultsSpecimen,
	},
	{
		id: 'recipe-form',
		title: 'Recipe form',
		description:
			'For adding and editing a recipe, and for reviewing an import, whose problems a summary at the top lists and links to until the first save; on the review page it takes focus. The member can mark each problem as checked, in the summary or beside its field, which dims it and counts it but never holds up saving. Ingredients and steps are lists of growing fields in sections, and each item’s menu moves or removes it; each ingredient shows how it will read. Tags show as chips and suggest the labels in use, still taking new ones, and editing can respell a tag no other recipe uses (here, Slow cooked on the pot roast). Chosen photos are resized and upload at once, and pages of the original recipe move up and down. Here uploads are simulated, and saving checks the recipe as the site does but saves nothing.',
		Content: RecipeFormSpecimen,
	},
	{
		id: 'recipe-entry',
		title: 'Adding a recipe',
		description:
			'Three ways in, one tab each, and a fourth for the member’s unsaved drafts, counted in its label; hidden tabs keep what was entered. A link or photos of the pages, which upload as they’re chosen, are read into a draft that opens in the recipe form for review. Reading takes up to a minute or two, so the form shows what it’s reading and for how long, announcing the stage once and not each second. Here each import waits four seconds and then shows its error, since nothing is imported.',
		Content: RecipeEntrySpecimen,
	},
] as const;

function RecipeGridSpecimen() {
	return (
		<RecipeGrid>
			{sampleRecipeSummaries.map((recipe) => (
				<li key={recipe.id}>
					<RecipeCard recipe={recipe} headingTag="h4" />
				</li>
			))}
		</RecipeGrid>
	);
}

function RecipePaginationSpecimen() {
	return (
		<Specimen>
			<RecipePagination
				page={5}
				pageCount={10}
				pageHref={() => '#recipe-pagination'}
				resultsHeadingId="recipe-pagination"
			/>
		</Specimen>
	);
}

function RecipeDetailSpecimen() {
	return (
		<Specimen className="px-0 py-10 sm:py-14">
			<PageContainer width="reading">
				<RecipeDetail
					recipe={sampleRecipeDetail}
					headingLevel={4}
					titleAction={<RecipeEditLink slug={sampleRecipeDetail.slug} />}
				/>
			</PageContainer>
		</Specimen>
	);
}

function SearchBarSpecimen() {
	return (
		<div className="grid gap-6 md:grid-cols-2">
			<Specimen label="From lg" figureClassName="max-lg:hidden">
				<HeaderSearchForm id="design-header-search" />
			</Specimen>
			<Specimen label="Below lg">
				<HeaderSearchLink />
			</Specimen>
		</div>
	);
}

function SearchResultsSpecimen() {
	return (
		<>
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
		</>
	);
}

function NoResultsSpecimen() {
	return (
		<div className="grid gap-6 lg:grid-cols-3">
			{noResultStates.map(({ label, state }) => (
				<Specimen key={label} label={label} frame="bare">
					<RecipeSearchEmptyState state={state} />
				</Specimen>
			))}
		</div>
	);
}

function RecipeFormSpecimen() {
	return recipeFormSamples.map(({ label, initial, editing }) => (
		<Specimen key={label} label={label} className="px-0 py-10 sm:py-14">
			<PageContainer width="reading">
				<SampleRecipeForm initial={initial} tagLabels={sampleTagLabels} editing={editing} />
			</PageContainer>
		</Specimen>
	));
}

function RecipeEntrySpecimen() {
	return (
		<>
			{entryDraftSamples.map(({ label, imports }) => (
				<Specimen key={label} label={label} className="px-0 py-10 sm:py-14">
					<PageContainer width="reading">
						<RecipeEntryTabs
							forms={{
								manual: (
									<SampleRecipeForm initial={recipeFormValues()} tagLabels={sampleTagLabels} />
								),
								url: <SampleUrlImportForm />,
								photo: <SampleScanImportForm />,
							}}
							unsavedImports={imports}
							now={sampleImportsNow}
						/>
					</PageContainer>
				</Specimen>
			))}
			<div className="grid gap-6 md:grid-cols-2">
				<Specimen label="While a link is read">
					<RecipeImportSubmit
						pending
						label="Import recipe"
						pendingLabel="Importing recipe"
						stage="Reading the page…"
					/>
				</Specimen>
				<Specimen label="While photos upload">
					<RecipeImportSubmit
						pending={false}
						label="Read recipe"
						pendingLabel="Reading recipe"
						stage="Reading the photos…"
						waitNote="Wait for the photos to finish uploading."
					/>
				</Specimen>
			</div>
		</>
	);
}

function CompositionSpecimens() {
	return (
		<div className="flex flex-col gap-16">
			<ReferenceSubsectionNav label="Compositions" subsections={subsections} />
			{subsections.map(({ id, title, description, Content }) => (
				<ReferenceSubsection key={id} id={id} title={title} description={description}>
					<Content />
				</ReferenceSubsection>
			))}
		</div>
	);
}

export { CompositionSpecimens };
