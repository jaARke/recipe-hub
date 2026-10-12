import { ReferenceSubsection, Specimen } from '@/components/design-reference/reference-section';
import { SamplePhotoUpload } from '@/components/design-reference/sample-photo-upload';
import {
	sampleRecipeDetail,
	sampleRecipeSummaries,
} from '@/components/design-reference/sample-recipe-dtos';
import { SampleRecipeForm } from '@/components/design-reference/sample-recipe-form';
import { PageContainer } from '@/components/layout/page-container';
import { RecipeCard } from '@/components/recipe/recipe-card';
import { RecipeDetail } from '@/components/recipe/recipe-detail';
import { RecipeGrid, RecipeGridSkeleton } from '@/components/recipe/recipe-grid';
import { RecipesEmptyState } from '@/components/recipe/recipes-empty-state';

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
				description="The home page before anyone adds a recipe."
			>
				<RecipesEmptyState />
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
