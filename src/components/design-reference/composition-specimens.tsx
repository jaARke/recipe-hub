import type { DraftSummaryDto } from '@/application/drafts/saved-draft-dtos';
import {
	ReferenceSubsection,
	ReferenceSubsectionNav,
	Specimen,
} from '@/components/design-reference/reference-section';
import { SampleFavoriteToggle } from '@/components/design-reference/sample-favorite-toggle';
import {
	sampleBrowsePage,
	sampleCatalogFacets,
	sampleContributor,
	sampleDrafts,
	sampleDraftsNow,
	sampleRecipeDetail,
	sampleRecipeSummaries,
	sampleSearchPage,
} from '@/components/design-reference/sample-recipe-dtos';
import {
	SampleEditingPage,
	type SampleEditingSubject,
} from '@/components/design-reference/sample-recipe-form';
import {
	SampleScanImportForm,
	SampleUrlImportForm,
} from '@/components/design-reference/sample-recipe-import';
import { SampleRecipeStart } from '@/components/design-reference/sample-recipe-start';
import { PageContainer } from '@/components/layout/page-container';
import type { EditedRecipe } from '@/components/recipe-form/recipe-form-fields';
import {
	recipeFormValues,
	type RecipeFormValues,
} from '@/components/recipe-form/recipe-form-values';
import { RecipeImportHeading } from '@/components/recipe-import/recipe-entry-heading';
import { RecipeImportSubmit } from '@/components/recipe-import/recipe-import-submit';
import { RecipeActions } from '@/components/recipe/recipe-actions';
import { RecipeDetail, RecipeDetailSkeleton } from '@/components/recipe/recipe-detail';
import { RecipeFilmstrip } from '@/components/recipe/recipe-filmstrip';
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
import { slugify } from '@/domain/recipe/slug';
import { settings } from '@/lib/settings';

const sampleBrowseState: RecipeSearchState = { holidays: [], diets: [], sort: 'newest', page: 1 };

const sampleSearchState: RecipeSearchState = {
	text: 'butter',
	holidays: [],
	diets: ['vegetarian'],
	contributorId: sampleContributor.id,
	sort: 'relevance',
	page: 1,
};

const noResultStates: readonly { label: string; state: RecipeSearchState }[] = [
	{
		label: 'A query',
		state: { text: 'biscuts', holidays: [], diets: [], sort: 'relevance', page: 1 },
	},
	{
		label: 'Filters',
		state: {
			chapter: 'soups-salads',
			holidays: ['christmas'],
			diets: [],
			sort: 'newest',
			page: 1,
		},
	},
	{
		label: 'A query with filters',
		state: { text: 'biscuts', holidays: ['christmas'], diets: [], sort: 'relevance', page: 1 },
	},
];

// Any id and version: the stand-in action never reads them, and they mark the form as editing.
const sampleEditedRecipe: EditedRecipe = {
	id: '0199c7a4-2c3e-7b1a-9f00-000000000001',
	version: '2026-10-12T00:00:00.000Z',
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

// A draft saved with only part of the recipe, opened from Drafts.
const sampleSavedDraft = {
	id: '0199d2a0-1b2c-7d3e-8f40-000000000004',
	title: 'Grandma’s pound cake',
	savedAt: new Date('2026-10-12T16:30:00.000Z'),
};

const sampleSavedDraftContent: RecipeDraftContent = {
	title: sampleSavedDraft.title,
	source: 'Grandma June',
	ingredientSections: [
		{ lines: [{ text: '1 pound butter, softened' }, { text: '3 cups sugar' }, { text: '6 eggs' }] },
	],
};

// The recipe form's pages, each with its heading's menu and its starting values as the page builds
// them. The draft read from photos adds stand-in pages of the original as the member's uploads, since
// no store holds a sample draft's scans.
const recipeFormSamples: readonly {
	label: string;
	subject: SampleEditingSubject;
	initial: RecipeFormValues;
	standInScans?: boolean;
}[] = [
	{ label: 'Adding a recipe', subject: { page: 'add' }, initial: recipeFormValues() },
	{
		label: 'Adding a recipe from a saved draft',
		subject: { page: 'add', draft: sampleSavedDraft },
		initial: recipeFormValues(sampleSavedDraftContent),
	},
	{
		label: 'Editing a recipe whose lists start with a heading',
		subject: {
			page: 'edit',
			recipe: sampleEditedRecipe,
			slug: slugify(sampleSundayPotRoast.title),
			title: sampleSundayPotRoast.title,
		},
		initial: recipeFormValues(parseRecipeContent(sampleSundayPotRoast)),
	},
	{
		label: 'A draft read from photos, with its notes to check',
		subject: {
			page: 'add',
			draft: {
				id: '0199d2a0-1b2c-7d3e-8f40-000000000003',
				title: sampleDraft.content.title,
				savedAt: new Date('2026-10-12T17:59:30.000Z'),
			},
			importedFrom: 'photo',
		},
		initial: recipeFormValues(sampleDraft.content, sampleDraft.problems),
		standInScans: true,
	},
];

// The start page as a draft's back link leaves for it, naming the draft, with the member's drafts,
// and with none.
const startSamples: readonly {
	label: string;
	drafts: readonly DraftSummaryDto[];
	kept?: DraftSummaryDto;
}[] = [
	{
		label: 'After leaving a draft',
		drafts: sampleDrafts,
		kept: sampleDrafts.find(({ mode }) => mode === undefined),
	},
	{ label: 'With no drafts', drafts: [] },
];

// One entry per composition, browsing first and contributing last.
const subsections = [
	{
		id: 'browse',
		title: 'Browse',
		description:
			'The collection as cards beside the search page’s filters, so one control serves Browse and Search, which differ in what they list. From lg the filters sit in a sidebar, each chapter, holiday, and diet with its count, over two columns of cards and three from xl; below lg the toolbar’s Filters opens the same form above the cards. Filters apply with their button and keep to Browse; the chapters, holidays, and diets on offer are those with recipes to count, and a chosen one stays so it can be cleared. Each card is a single link to its recipe, and a recipe without a photo keeps the photo’s box. Here six of its cards; its links lead to Browse.',
		Content: BrowseSpecimen,
	},
	{
		id: 'browse-loading',
		title: 'Browse, loading',
		description: 'Skeletons hold the same layout while recipes load.',
		Content: BrowseSkeletonSpecimen,
	},
	{
		id: 'recipe-grid',
		title: 'Recipe grid',
		description:
			'Favorites’ cards across the page: one column on phones, two on tablets, three on desktop. Each card is a single link to its recipe, and a recipe without a photo keeps the photo’s box.',
		Content: RecipeGridSpecimen,
	},
	{
		id: 'recipe-grid-loading',
		title: 'Recipe grid, loading',
		description: 'Skeletons hold the same layout while recipes load.',
		Content: RecipeGridSkeletonSpecimen,
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
			'Reading width, with ingredients and steps in text-lg: each ingredient bulleted and each step numbered in one muted marker column, so their text shares a left edge and a line that wraps stays one ingredient. Under the title and its credit, a ruled block holds a row of labelled cells for the times and yield, one for who added the recipe, when, and when it was edited if on a later day, and one for its chapter, a link to the chapter’s list, then any holidays and diets as badges linking to theirs; a row or cell with nothing to show is left out. The recipe’s actions follow, then the dish photos in a filmstrip, here a row of four, the description, and the original recipe’s pages in a filmstrip of their own, each image whole in its own shape and opening the viewer at itself. The pencil beside the title, for the contributor and admins, opens the edit page. Its headings start at h4 here, under this page’s own.',
		Content: RecipeDetailSpecimen,
	},
	{
		id: 'recipe-detail-loading',
		title: 'Recipe detail, loading',
		description:
			'Skeletons hold the header’s place as most recipes fill it, every row of the ruled block included, while a recipe that was not prerendered loads.',
		Content: RecipeDetailSkeletonSpecimen,
	},
	{
		id: 'recipe-filmstrip',
		title: 'Photo filmstrip and viewer',
		description:
			'A recipe’s dish photos, and the pages of its original, show whole in their own shapes. One image runs across the column, narrowed where it would stand taller than 576px or 70% of the screen; several sit in a row at one height, 240px on phones and 320px from sm for photos and 208px and 288px for pages, that scrolls sideways and snaps to each image, a wide one narrowed to 82% of the column so the next always peeks in. A mouse gets arrows at the row’s ends, and the printout leaves the images out. A photo stored before sizes were recorded takes a 3:2 box and shows whole inside it. Each image opens the viewer at itself: full screen in the page’s paper or ink, with where you are, the zoom, a page’s Full size, and Close along the top; Previous and Next at the sides from sm and under the image on phones; the description, announced with the image’s place as it changes; and a strip of every image in its own shape, a very wide one cropped. The image zooms by a pinch, by the wheel with Ctrl or Cmd or a trackpad’s pinch, toward the pointer, by a double tap or click to 250% at that point and back, and by the buttons or + and −, with 0 to fit; zoomed, a drag, a trackpad’s scroll, or the arrow keys pan it, and only while it’s whole does a swipe or Left and Right move to the next image. Moving to another image shows it whole.',
		Content: RecipeFilmstripSpecimen,
	},
	{
		id: 'recipe-actions',
		title: 'Recipe actions',
		description:
			'One group under a recipe’s details, 44 px tall under a finger. Start cooking opens the cooking view. The favorite toggle keeps its label and name while its heart fills red and its surface shows pressed, and its box is held while it loads; here a stand-in that saves nothing. More actions opens a menu: Share opens the device’s share sheet, and shows only where the browser has one, which desktop Firefox lacks; Copy link copies the link and says so; Print prints the recipe with its link in place of these actions, without the header or the photos. Links name the host the page is on, so a preview shares its own pages; here they name the sample recipe, which has no page.',
		Content: RecipeActionsSpecimen,
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
			'The header’s search, at this screen’s width: from lg a field that fills the row, and below lg an icon that turns the header’s row into the field, with Cancel to bring the row back. A search keeps the filters of the page it is typed on, Browse’s or Search’s, and on Search the order too. On the search page the field holds the query, with Clear search to empty it and return to Browse with the filters, and below lg the header opens with the field.',
		Content: SearchBarSpecimen,
	},
	{
		id: 'search-results',
		title: 'Search results',
		description:
			'A search for butter among vegetarian recipes added by one member, as it shows under the page’s heading and syntax hint. From lg the filters sit beside the results, over the count and the order. Below lg a toolbar holds Filters, with the applied count, and the order in one row, then the count; Filters opens the filters in the page’s flow beneath the row, and Apply filters closes them and moves focus to the results. Filters apply with their button, while the order applies on selection. The words and each active filter are inked pills that remove themselves, the words returning to Browse with the filters, and Clear filters keeps the words; focus moves to the results as one goes. The count is announced as it changes, and matches are marked. Its headings start at h4 here.',
		Content: SearchResultsSpecimen,
	},
	{
		id: 'search-results-loading',
		title: 'Search results, loading',
		description: 'Skeletons hold the same layout while results load.',
		Content: SearchResultsSkeletonSpecimen,
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
			'For adding and editing a recipe, an import’s draft included. An import’s notes sit under what they’re about, and an intro counts them and starts on the first, taking focus as the form opens. Editing a field clears its note, and so does Looks right, which moves on to the next note and says how many are left; an empty title or list must be filled instead. A scan’s [illegible] or [?] left in the text is noted too, and marked in the line’s preview, until it’s edited away. Saving with anything left to check asks first, with Show me and Add anyway (Save anyway when editing); notes survive a failed save, whose errors a summary at the top lists and links to, saying what fixing them is for: before adding it to the cookbook, or to save. Ingredients and steps are each one list of growing fields, with headings as rows among the lines: Enter adds a line below, Backspace in an empty one removes it, and a pasted list splits into lines and headings, each announced. A row’s menu moves it up or down, across headings, changes it between a line and a heading, or removes it, and a removed heading’s lines join the ones above; each ingredient shows how it will read. Chapter, Holidays and Diet file the recipe in the cookbook: one chapter, which saving needs, and any holidays and diets, each list in two columns (the chapters from sm); ticking Vegan ticks and holds Vegetarian and Dairy-free, and a line says why. Chosen photos are resized and upload at once, and pages of the original recipe move up and down. From lg, a form with pages of the original holds them to the right of its fields, in view as the form scrolls, a page at a time, zooming as the viewer’s images do, with the zoom’s buttons and Full size above it and a strip of the pages below, so Add to cookbook, or Save changes when editing, sits under the fields; below lg, View original opens the viewer. Adding a recipe offers Save as draft beside Add to cookbook (Save draft on phones), which saves whatever is there and says when in the action bar. Adding a recipe is headed by the draft’s title as saved, Untitled recipe until it has one, under the back link to the start page, which says there that the draft is kept once the form holds one, and over where an import read it. The page’s heading holds a menu of what can be done to what it edits, each Delete confirmed in a dialog: View recipe and Delete recipe when editing, and Delete draft once the form holds a saved draft, opened or just saved; a new recipe has none. Here uploads are simulated, the draft read from photos is of an anise cakes card from the National Archives, whose two pages show as uploads, saving checks the recipe as the site does but saves nothing, a draft is saved nowhere, and nothing is deleted.',
		Content: RecipeFormSpecimen,
	},
	{
		id: 'recipe-entry',
		title: 'Adding a recipe',
		description:
			'The start page offers the three ways to start a recipe, each a row with its icon, title, line, and chevron that opens its page, then the member’s drafts, newest first: those they saved and the imports they haven’t, each a link to where it continues, described by how it started, when it was saved, and when it goes, with a ⋯ menu holding Delete draft, which asks first. A draft’s back link leaves for it with a notice naming the draft, which back and forward don’t bring back, and back or forward read the drafts again, so each shows as it now is. A link and photos each have a page of their own under the back link to the start page; the photos upload as they’re chosen, and either is read into a draft that opens in the recipe form for review. Reading takes up to a minute or two, so the form shows what it’s reading and for how long, announcing the stage once and not each second. Here each import waits four seconds and then shows its error, since nothing is imported, and deleting a draft is refused.',
		Content: RecipeEntrySpecimen,
	},
] as const;

// Its own heading heads the cards, as the page's does.
function BrowseSpecimen() {
	return (
		<Specimen className="flex flex-col gap-8">
			<h4 id="design-browse-heading" tabIndex={-1} className="font-heading text-2xl font-semibold">
				Recipes
			</h4>
			<RecipeSearch
				state={sampleBrowseState}
				results={sampleBrowsePage}
				pageCount={Math.ceil(sampleBrowsePage.total / settings.display.recipesPerPage)}
				headingLevel={4}
				resultsHeadingId="design-browse-heading"
			/>
		</Specimen>
	);
}

function BrowseSkeletonSpecimen() {
	return <RecipeSearchSkeleton mode="browse" />;
}

function RecipeGridSpecimen() {
	return (
		<RecipeGrid
			layout="fullWidth"
			recipes={sampleRecipeSummaries}
			headingTag="h4"
			backLabel="Back to Favorites"
		/>
	);
}

function RecipeGridSkeletonSpecimen() {
	return <RecipeGridSkeleton layout="fullWidth" />;
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
					favoriteToggle={<SampleFavoriteToggle recipeId={sampleRecipeDetail.id} />}
				/>
			</PageContainer>
		</Specimen>
	);
}

function RecipeDetailSkeletonSpecimen() {
	return (
		<Specimen className="px-0 py-10 sm:py-14">
			<PageContainer width="reading">
				<RecipeDetailSkeleton />
			</PageContainer>
		</Specimen>
	);
}

// The seed's first photo alone, and the next two as a photo stored before sizes were recorded beside
// one with its size.
const sampleLonePhoto = sampleRecipeDetail.images.slice(0, 1);
const sampleUnsizedAndSizedPhotos = sampleRecipeDetail.images
	.slice(1, 3)
	.map(({ role, pathname, alt, size }, index) =>
		index === 0 ? { role, pathname, alt } : { role, pathname, alt, size }
	);

function RecipeFilmstripSpecimen() {
	return (
		<div className="flex flex-col gap-6">
			<Specimen label="One photo" className="px-0 py-10 sm:py-14">
				<PageContainer width="reading">
					<RecipeFilmstrip role="dish" title={sampleRecipeDetail.title} images={sampleLonePhoto} />
				</PageContainer>
			</Specimen>
			<Specimen
				label="A photo stored before sizes were recorded, beside one with its size"
				className="px-0 py-10 sm:py-14"
			>
				<PageContainer width="reading">
					<RecipeFilmstrip
						role="dish"
						title={sampleRecipeDetail.title}
						images={sampleUnsizedAndSizedPhotos}
					/>
				</PageContainer>
			</Specimen>
		</div>
	);
}

function RecipeActionsSpecimen() {
	return (
		<Specimen>
			<RecipeActions
				slug={sampleRecipeDetail.slug}
				title={sampleRecipeDetail.title}
				favoriteToggle={<SampleFavoriteToggle recipeId={sampleRecipeDetail.id} />}
			/>
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
						state={sampleBrowseState}
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

function SearchResultsSkeletonSpecimen() {
	return <RecipeSearchSkeleton mode="search" />;
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
	return recipeFormSamples.map(({ label, subject, initial, standInScans }) => (
		<Specimen key={label} label={label} className="px-0 py-10 sm:py-14">
			<PageContainer width="readingOrWide" className="flex flex-col gap-8">
				<SampleEditingPage subject={subject} initial={initial} standInScans={standInScans} />
			</PageContainer>
		</Specimen>
	));
}

function RecipeEntrySpecimen() {
	return (
		<>
			{startSamples.map(({ label, drafts, kept }) => (
				<Specimen key={label} label={label} className="px-0 py-10 sm:py-14">
					<PageContainer width="reading">
						<SampleRecipeStart drafts={drafts} kept={kept} now={sampleDraftsNow} />
					</PageContainer>
				</Specimen>
			))}
			<div className="grid gap-6 lg:grid-cols-2">
				<Specimen label="From a link" className="flex flex-col gap-8">
					<RecipeImportHeading mode="url" headingTag="h4" />
					<SampleUrlImportForm />
				</Specimen>
				<Specimen label="From photos" className="flex flex-col gap-8">
					<RecipeImportHeading mode="photo" headingTag="h4" />
					<SampleScanImportForm />
				</Specimen>
			</div>
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
