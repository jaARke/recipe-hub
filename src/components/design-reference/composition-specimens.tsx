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
import { HeaderSearchBar } from '@/components/search/header-search-bar';
import {
	RecipeSearch,
	RecipeSearchCloseMatches,
	RecipeSearchSkeleton,
} from '@/components/search/recipe-search';
import { RecipeSearchEmptyState } from '@/components/search/recipe-search-empty-state';
import { RecipeSearchFiltersSidebar } from '@/components/search/recipe-search-filters';
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

// The anise cakes card beside it, as the scan extractor might hand it over: the card's ground truth in
// scripts/evaluate/cases/anise-cakes/expected.json, but with no title, a line it couldn't wholly read,
// and a step and the whole card to check against the original.
const sampleDraft: { content: RecipeDraftContent; problems: Problem[] } = {
	content: {
		yield: { kind: 'makes', amount: { min: 50 }, unit: 'one and a half inch cakes' },
		ingredientSections: [
			{
				lines: [
					{ text: '1 cup sugar' },
					{ text: '3 eggs' },
					{ text: '½ tsp. vanilla' },
					{ text: '1½ to 2 cup flour' },
					{ text: '1 tsp. any baking powder' },
					{ text: '1½ tbls crushed anise [illegible]' },
				],
			},
		],
		instructionSections: [
			{
				steps: [
					{ text: 'Sift. 1 cup sugar.' },
					{ text: 'Beat until light 3 eggs.' },
					{ text: 'Add sugar gradually. Beat these ingredients until they are creamy.' },
					{ text: 'Add. ½ tsp. vanilla.' },
					{ text: 'Sift. before measuring. 1½ to 2 cup flour' },
					{ text: 'Resift with 1 tsp. any baking powder.' },
					{ text: 'Add. 1½ tbls crushed anise Seed.' },
					{
						text: 'Beat batter well, Drop from teaspoon, well apart on greased tins. Permit batter to dry for 12 hrs.',
					},
					{ text: 'Bake cakes in slow moderate oven 350°.' },
				],
			},
		],
		tags: ['Baking'],
	},
	problems: [
		{ path: 'title', message: 'Add a title. The card’s heading was hard to read.' },
		{
			path: 'ingredientSections.0.lines.5',
			message: 'Check this line against the original. Part of it was hard to read.',
		},
		{
			path: 'instructionSections.0.steps.8',
			message: 'Check this step against the original. The oven’s temperature was hard to read.',
		},
		{
			path: '',
			message: 'The recipe runs onto a second card. Check that nothing was missed between them.',
		},
	],
};

// The recipe form's starting values, as its pages build them. The review adds stand-in pages of the
// original as the member's uploads, since a draft's own scans need sign-in.
const recipeFormSamples: readonly {
	label: string;
	initial: RecipeFormValues;
	editing?: EditedRecipe;
	standInScans?: boolean;
}[] = [
	{ label: 'Adding a recipe', initial: recipeFormValues() },
	{
		label: 'Editing a recipe whose lists start with a heading',
		initial: recipeFormValues(parseRecipeContent(sampleSundayPotRoast)),
		editing: sampleEditedRecipe,
	},
	{
		label: 'Reviewing an import, with its notes to check',
		initial: recipeFormValues(sampleDraft.content, sampleDraft.problems),
		standInScans: true,
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
			'The header’s search, at this screen’s width: from lg a field that fills the row, and below lg an icon that turns the header’s row into the field, with Cancel to bring the row back. Away from the search page it starts a fresh search; on the search page the field holds the query, the page’s filters and order join its form, and below lg the header opens with the field.',
		Content: SearchBarSpecimen,
	},
	{
		id: 'search-results',
		title: 'Search results',
		description:
			'A search for butter among baking recipes added by one member, as it shows under the page’s heading and syntax hint. From lg the filters sit beside the results, over the count and the order. Below lg a toolbar holds Filters, with the applied count, and the order in one row, then the count; Filters opens the filters in the page’s flow beneath the row, and Apply filters closes them and moves focus to the results. Filters apply with their button, while the order applies on selection. Active filters are links that remove themselves, the count is announced as it changes, and matches are marked. Its headings start at h4 here.',
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
			'For adding and editing a recipe, and for reviewing an import. An import’s notes sit under what they’re about, and an intro counts them and starts on the first; on the review page it takes focus. Editing a field clears its note, and so does Looks right, which moves on to the next note and says how many are left; an empty title or list must be filled instead. A scan’s [illegible] or [?] left in the text is noted too, and marked in the line’s preview, until it’s edited away. Saving with anything left to check asks first, with Show me and Save anyway; notes survive a failed save, whose errors a summary at the top lists and links to. Ingredients and steps are each one list of growing fields, with headings as rows among the lines: Enter adds a line below, Backspace in an empty one removes it, and a pasted list splits into lines and headings, each announced. A row’s menu moves it up or down, across headings, changes it between a line and a heading, or removes it, and a removed heading’s lines join the ones above; each ingredient shows how it will read. Tags show as chips and suggest the labels in use, still taking new ones, and editing can respell a tag no other recipe uses (here, Slow cooked on the pot roast). Chosen photos are resized and upload at once, and pages of the original recipe move up and down. From lg, a form with pages of the original holds them beside it, in view as the form scrolls, a page at a time with Zoom and Full size; below lg, View original opens the viewer. Here uploads are simulated, the review is of an anise cakes card from the National Archives, whose two pages show as uploads, and saving checks the recipe as the site does but saves nothing.',
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
		<Specimen>
			<div className="flex items-center">
				<HeaderSearchBar formId="design-header-search" />
			</div>
		</Specimen>
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
	return recipeFormSamples.map(({ label, initial, editing, standInScans }) => (
		<Specimen key={label} label={label} className="px-0 py-10 sm:py-14">
			<PageContainer width="readingOrWide">
				<SampleRecipeForm
					initial={initial}
					tagLabels={sampleTagLabels}
					editing={editing}
					standInScans={standInScans}
				/>
			</PageContainer>
		</Specimen>
	));
}

function RecipeEntrySpecimen() {
	return (
		<>
			{entryDraftSamples.map(({ label, imports }) => (
				<Specimen key={label} label={label} className="px-0 py-10 sm:py-14">
					<PageContainer width="readingOrWide">
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
