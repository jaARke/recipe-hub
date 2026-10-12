import { sampleCatalogFacets } from '@/components/design-reference/fixtures';
import { ReferenceSubsection, Specimen } from '@/components/design-reference/reference-section';
import { SamplePhotoUpload } from '@/components/design-reference/sample-photo-upload';
import {
	sampleRecipeDetail,
	sampleRecipeSummaries,
	sampleSearchPage,
} from '@/components/design-reference/sample-recipe-dtos';
import { SampleRecipeForm } from '@/components/design-reference/sample-recipe-form';
import { PageContainer } from '@/components/layout/page-container';
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

const sampleSearchState: RecipeSearchState = {
	text: 'butter',
	tags: ['Baking'],
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
				description="A search for butter among baking recipes. Filters sit beside the results from lg and fold into a disclosure below it; they apply with their button, while the order applies on selection. Active filters are links that remove themselves, the count is announced as it changes, and matches are marked. Its headings start at h4 here."
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
				description="The field layout for manual entry and import review. Ingredients and steps are lists of growing fields, grouped into sections with optional headings. It does not save anything."
			>
				<Specimen className="px-0 py-10 sm:py-14">
					<PageContainer width="reading">
						<SampleRecipeForm />
					</PageContainer>
				</Specimen>
			</ReferenceSubsection>
			<ReferenceSubsection
				id="photo-upload"
				title="Photo upload"
				description="Drag photos onto the drop area, or choose them with the button, which opens the native picker; the file input itself is never shown. Chosen files are listed below it. Nothing uploads: the upload states are under Attachment."
			>
				<Specimen className="px-0 py-10 sm:py-14">
					<PageContainer width="reading">
						<SamplePhotoUpload />
					</PageContainer>
				</Specimen>
			</ReferenceSubsection>
		</div>
	);
}

export { CompositionSpecimens };
