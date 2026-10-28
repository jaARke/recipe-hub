import type { DraftSummaryDto } from '@/application/drafts/saved-draft-dtos';
import type { RecipeSearchPage } from '@/application/search/recipe-search-dtos';
import { RecipeChaptersSpecimen } from '@/components/design-reference/recipe-chapters-specimen';
import { RecipeFilterFormSpecimen } from '@/components/design-reference/recipe-filter-form-specimen';
import { RecipeFilterSheetSpecimen } from '@/components/design-reference/recipe-filter-sheet-specimen';
import { RecipePageSearchSpecimen } from '@/components/design-reference/recipe-page-search-specimen';
import {
	ReferenceSubsection,
	ReferenceSubsectionNav,
	Specimen,
} from '@/components/design-reference/reference-section';
import { SampleFavoriteToggle } from '@/components/design-reference/sample-favorite-toggle';
import {
	sampleBrowsePage,
	sampleChapterSearchPage,
	sampleContributor,
	sampleDrafts,
	sampleDraftsNow,
	sampleGlutenFreeDessertsPage,
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
import { recipeChapterRows } from '@/components/search/recipe-chapter-rows';
import {
	RecipeSearch,
	RecipeSearchCloseMatches,
	RecipeSearchSkeleton,
	RecipesPageGrid,
	RecipesViewHeader,
	RecipesViewHeaderSkeleton,
} from '@/components/search/recipe-search';
import { RecipeSearchEmptyState } from '@/components/search/recipe-search-empty-state';
import { recipesView, type RecipeSearchState } from '@/components/search/search-params';
import type { Problem } from '@/domain/problem';
import { parseRecipeContent } from '@/domain/recipe/recipe';
import type { RecipeDraftContent } from '@/domain/recipe/recipe-draft';
import { sampleSundayPotRoast } from '@/domain/recipe/samples/sample-recipes';
import { slugify } from '@/domain/recipe/slug';
import { settings } from '@/lib/settings';

// The Recipes page's views, each with the page of results it shows.
const recipesPageSamples: readonly {
	label: string;
	idPrefix: string;
	state: RecipeSearchState;
	results: RecipeSearchPage;
}[] = [
	{
		label: 'All Recipes, as the page first opens',
		idPrefix: 'design-recipes-all',
		state: recipesView(),
		results: sampleBrowsePage,
	},
	{
		label: 'Desserts, filtered by gluten-free',
		idPrefix: 'design-recipes-desserts',
		state: { ...recipesView('desserts'), diets: ['gluten-free'] },
		results: sampleGlutenFreeDessertsPage,
	},
	{
		label: 'Cookies & Candy searched for butter, among vegetarian recipes one member added',
		idPrefix: 'design-recipes-search',
		state: {
			text: 'butter',
			chapter: 'cookies-candy',
			holidays: [],
			diets: ['vegetarian'],
			contributorId: sampleContributor.id,
			sort: 'relevance',
			page: 1,
		},
		results: sampleChapterSearchPage,
	},
];

const noResultStates: readonly { label: string; state: RecipeSearchState }[] = [
	{
		label: 'A chapter searched for words none of its recipes match',
		state: { ...recipesView('soups-salads'), text: 'biscuit', sort: 'relevance' },
	},
	{
		label: 'A search with a filter',
		state: { ...recipesView(), text: 'biscuit', diets: ['vegan'], sort: 'relevance' },
	},
	{
		label: 'A chapter with a filter',
		state: { ...recipesView('desserts'), holidays: ['easter'] },
	},
	{
		label: 'A chapter no one has filed a recipe in',
		state: recipesView('appetizers-beverages'),
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
		id: 'recipes-page',
		title: 'Recipes page',
		description:
			'One page for browsing and searching every recipe. Its heading names the view, All Recipes or the chapter, under a link back to All Recipes in a chapter, which keeps the words and the filters; below lg the heading opens the chapters in a sheet, and from lg it is plain text beside the sidebar, which holds the chapters above Filter and sort, as their own specimens show. The search box under the heading searches within the view. Above the recipes come Filter and sort’s button below lg, then the filters applied, after Filtered by:, as outlined chips that remove themselves, with Clear all once there are two, then the count line. The count line is the page’s polite status: the count and the order, with the words searched for, and for screen readers alone, close matches and the page. With words each recipe marks what they matched, and outside a chapter each names its chapter, 24 to a page. A recipe opened from the page links back to its view by the view’s name, such as Back to Desserts, or as Back to search results. A link that changes the list and takes focus with it, such as a chip, Clear all, or a page’s number, leaves focus on the heading. Here its links and forms open the real Recipes page, its sections’ headings are h4, and its recipes’ h5.',
		Content: RecipesPageSpecimen,
	},
	{
		id: 'recipes-page-loading',
		title: 'Recipes page, loading',
		description:
			'Skeletons hold the heading and the search box, and from lg the sidebar’s chapters and filters beside the rows or cards, while the view is read. The header’s search waits for them to give way before it empties.',
		Content: RecipesPageSkeletonSpecimen,
	},
	{
		id: 'recipes-no-results',
		title: 'No results',
		description:
			'An empty view says why, its message in the middle of its box, and offers the ways out it has: Clear search with words, Clear filters with filters, and in a chapter with words, a search of All Recipes for them; a chapter with no recipes offers none. The count line says the same to screen readers. A cookbook with no recipes at all shows the empty state instead, and words no recipe matches exactly show close matches under a notice.',
		Content: NoResultsSpecimen,
	},
	{
		id: 'recipe-grid',
		title: 'Recipe grid',
		description:
			'The list the Recipes page and Favorites share. Below sm each recipe is a row, a small photo beside its words, so a phone shows several at once; from sm each is a card, two across, and three from lg on Favorites or from xl beside the Recipes page’s sidebar. Both sit in the card’s inked edge, which brightens to the text’s color when hovered. Each is a single link to its recipe, named by its title, with its holiday and diet badges, and a recipe without a photo keeps the photo’s box. Outside a chapter each names its chapter above the title, and searching with words, its title and the passage the words matched are marked. Its titles are h4 here.',
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
			'A recipe’s dish photos, and the pages of its original, show whole in their own shapes. One image runs across the column, narrowed where it would stand taller than 576px or 70% of the screen; several sit in a row at one height, 240px on phones and 320px from sm for photos and 208px and 288px for pages, that scrolls sideways and snaps to each image, a wide one narrowed to 82% of the column so the next always peeks in. A mouse gets arrows at the row’s ends, and the printout leaves the images out. A photo stored before sizes were recorded takes a 3:2 box and shows whole inside it. Each image opens the viewer at itself: full screen in the page’s paper or ink, with where you are, the zoom, Full size, and Close along the top; Previous and Next at the sides from sm and under the image on phones; the description, announced with the image’s place as it changes; and a strip of every image in its own shape, a very wide one cropped. The image zooms by a pinch, by the wheel with Ctrl or Cmd or a trackpad’s pinch, toward the pointer, by a double tap or click to 250% at that point and back, and by the buttons or + and −, with 0 to fit; zoomed, a drag, a trackpad’s scroll, or the arrow keys pan it, and only while it’s whole does a swipe or Left and Right move to the next image. Moving to another image shows it whole.',
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
		description: 'The Recipes page before anyone adds a recipe.',
		Content: RecipesEmptyState,
	},
	{
		id: 'search-bar',
		title: 'Search bar',
		description:
			'The header’s search, at this screen’s width: from lg a field that fills the row, and below lg an icon that turns the header’s row into the field, with Cancel to bring the row back. It searches every recipe from scratch, whatever page it is typed on, so it leads to All Recipes with its words alone. Once submitted the field keeps its words, read-only with a spinner in place of its icon, until the results show, then empties, and below lg closes and gives focus to the icon, since the Recipes page’s own search holds the words. Here a search leaves for its results.',
		Content: SearchBarSpecimen,
	},
	{
		id: 'recipe-page-search',
		title: 'Page search',
		description:
			'The Recipes page’s own search, under its heading. Its label stays in view above the field and names what it searches, All Recipes or the chapter, and a search keeps the chapter and the filters, ordered by best match from the first page. The words stay in the field to be refined, with an × that clears them alone, keeping the chapter, the filters, and an order chosen apart from best match, and leaving focus in the field. Here each form searches the real pages.',
		Content: RecipePageSearchSpecimen,
	},
	{
		id: 'recipe-chapters',
		title: 'Chapters',
		description:
			'The Recipes page’s table of contents: All Recipes and the nine chapters, each counted within the words and the filters, and each a link to its view that keeps them, from the first page. The sidebar lists them under Chapters with each count at the right, the current one in semibold with a rule at its left, and a chapter with none muted but still a link. The heading follows this screen’s width: from lg, where the sidebar shows, it is plain text; below lg it is the list’s trigger, the view’s name with a still chevron, described as choosing a chapter, and opens a bottom sheet titled Chapters whose rows give each count in recipes and check the current one. Choosing a row closes the sheet and leaves focus on the heading as the chapter opens; closing it otherwise, or Back or Forward to another view, returns focus to the heading’s button. Here its links lead to the real pages, and its headings are h4.',
		Content: RecipeChaptersSpecimen,
	},
	{
		id: 'recipe-filter-form',
		title: 'Filter and sort',
		description:
			'The Recipes page’s sidebar from lg, under the chapters: Sort by, then Holidays, Diet, Total time, Recipe from, and Added by, every group open, its radios and checkboxes in 36 px rows. Each option shows in parentheses what choosing it would show; one with none is dimmed and disabled unless chosen, and keeps focus when it is let go at zero. Recipe from folds its names after the first six under More names, which opens on its own when a name inside is chosen and closes again when asked. Each choice applies at once as a new page in the history, focus staying on the control; an any choice and the view’s own order leave the URL, and Clear all, beside the heading once a filter applies, keeps the words, the chapter, and the order. Here each form opens the real Recipes page, over the sample recipes’ counts.',
		Content: RecipeFilterFormSpecimen,
	},
	{
		id: 'recipe-filter-sheet',
		title: 'Filter and sort sheet',
		description:
			'Filter and sort below lg: a button counting the filters applied opens the same form in a bottom sheet, its options in two columns and every group open, folding as the sidebar does. Choices wait for Show N recipes, whose count follows them a moment after each change, showing only the latest choice’s count; it reads Show recipes while counting or when the count fails, and still applies them. Screen readers hear each new count. Clear all clears the sheet’s choices, not the view’s; closing drops what wasn’t applied, as does Back or Forward to another view, which closes the sheet, and Show closes the sheet with focus on the page’s heading. Here a stand-in answers the count after a moment with the smallest of the view’s total and the chosen filters’ counts, and Show opens the real Recipes page.',
		Content: RecipeFilterSheetSpecimen,
	},
	{
		id: 'recipe-form',
		title: 'Recipe form',
		description:
			'For adding and editing a recipe, an import’s draft included. An import’s notes sit under what they’re about, and an intro counts them and starts on the first, taking focus as the form opens, and once none are left says everything’s checked, taking focus as the last looks right. Editing a field clears its note, and so does Looks right, which moves on to the next note and says how many are left; an empty title or list must be filled instead. A scan’s [illegible] or [?] left in the text is noted too, and marked in the line’s preview where one shows, until it’s edited away. Saving with anything left to check asks first, with Show me and Add anyway (Save anyway when editing); notes survive a failed save, whose errors a summary at the top lists and links to, saying what fixing them is for: before adding it to the cookbook, or to save. Ingredients and steps are each one list of growing fields, with headings as rows among the lines: Enter adds a line below, Backspace in an empty one removes it, and a pasted list splits into lines and headings, each announced. A row’s menu moves it up or down, across headings, changes it between a line and a heading, or removes it, and a removed heading’s lines join the ones above; an ingredient the recipe will show otherwise than typed, such as 1/2 as ½, says how it will read. Chapter, Holidays and Diet file the recipe in the cookbook: one chapter, which saving needs, and any holidays and diets, each list in two columns (the chapters from sm); ticking Vegan ticks and holds Vegetarian and Dairy-free, and a line says why. Chosen photos are resized and upload at once, and pages of the original recipe move up and down. From lg, a form with pages of the original holds them to the right of its fields, in view as the form scrolls, a page at a time, zooming as the viewer’s images do, with the zoom’s buttons and Full size above it and a strip of the pages below, so Add to cookbook, or Save changes when editing, sits under the fields; below lg, View original opens the viewer. Adding a recipe saves a draft a moment after each change, once the form holds something, and deletes it once the form is emptied; the action bar’s right says while a draft saves, once it’s saved, and what went wrong, and nothing while there’s nothing to save. Finish later sits beside Add to cookbook and leaves for the start page once what the form shows is saved. Adding a recipe is headed by the draft’s title as saved, Untitled recipe until it has one, under the back link to the start page, which says there that the draft is kept once the form holds one, and over where an import read it. The page’s heading holds a menu of what can be done to what it edits, each Delete confirmed in a dialog: View recipe and Delete recipe when editing, and Delete draft once the form holds a saved draft, opened or just saved; a new recipe has none. Here uploads are simulated, the draft read from photos is of an anise cakes card from the National Archives, whose two pages show as uploads, saving checks the recipe as the site does but saves nothing, a draft is saved nowhere, Finish later stays here, and nothing is deleted.',
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

// Each view as the page composes it, the heading's sheet given the chapters at once.
function RecipesPageSpecimen() {
	return recipesPageSamples.map(({ label, idPrefix, state, results }) => {
		const chapterRows = recipeChapterRows(state, results.facets);
		return (
			<Specimen key={idPrefix} label={label}>
				<RecipesPageGrid>
					<RecipesViewHeader
						idPrefix={idPrefix}
						state={state}
						chapterRows={Promise.resolve(chapterRows)}
						headingTag="h4"
					/>
					<RecipeSearch
						idPrefix={idPrefix}
						state={state}
						results={results}
						pageCount={Math.ceil(results.total / settings.display.recipesPerPage)}
						chapterRows={chapterRows}
						headingTag="h4"
					/>
				</RecipesPageGrid>
			</Specimen>
		);
	});
}

function RecipesPageSkeletonSpecimen() {
	return (
		<Specimen>
			<RecipesPageGrid>
				<RecipesViewHeaderSkeleton />
				<RecipeSearchSkeleton />
			</RecipesPageGrid>
		</Specimen>
	);
}

// The search for butter within one chapter, so its recipes name none.
const sampleChapterSearchEntries = sampleSearchPage.results
	.filter(({ recipe }) => recipe.chapter === 'cookies-candy')
	.map(({ recipe, title, snippet }) => ({ recipe, highlights: { title, snippet } }));

function RecipeGridSpecimen() {
	return (
		<>
			<Specimen label="Favorites, from every chapter" frame="bare">
				<RecipeGrid
					layout="fullWidth"
					entries={sampleRecipeSummaries.map((recipe) => ({ recipe }))}
					namesChapter
					headingTag="h4"
					backLabel="Back to Favorites"
				/>
			</Specimen>
			<Specimen label="Searching for butter in Cookies & Candy" frame="bare">
				<RecipeGrid
					layout="fullWidth"
					entries={sampleChapterSearchEntries}
					namesChapter={false}
					headingTag="h4"
					backLabel="Back to Cookies & Candy"
				/>
			</Specimen>
		</>
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
				<HeaderSearchBar idPrefix="design-header-search" />
			</div>
		</Specimen>
	);
}

function NoResultsSpecimen() {
	return (
		<>
			<div className="grid gap-6 lg:grid-cols-2">
				{noResultStates.map(({ label, state }) => (
					<Specimen key={label} label={label} frame="bare">
						<RecipeSearchEmptyState state={state} />
					</Specimen>
				))}
			</div>
			<Specimen label="When no recipe matches the words exactly, above the close matches">
				<RecipeSearchCloseMatches text="chiken soup" />
			</Specimen>
		</>
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
						label="Read recipe"
						pendingLabel="Reading recipe"
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
