import * as React from 'react';
import { sampleRecipeCards } from '@/components/design-reference/fixtures';
import { RecipeDetailExcerpt } from '@/components/design-reference/recipe-detail-excerpt';
import { ReferenceSubsection, Specimen } from '@/components/design-reference/reference-section';
import { SamplePhotoUpload } from '@/components/design-reference/sample-photo-upload';
import { SampleRecipeForm } from '@/components/design-reference/sample-recipe-form';
import { PageContainer } from '@/components/layout/page-container';
import { RecipeCard, RecipeCardSkeleton } from '@/components/recipe/recipe-card';
import { RecipesEmptyState } from '@/components/recipe/recipes-empty-state';

const skeletonCount = sampleRecipeCards.length;

function RecipeGrid({ children }: { children: React.ReactNode }) {
	return <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{children}</ul>;
}

function CompositionSpecimens() {
	return (
		<div className="flex flex-col gap-16">
			<ReferenceSubsection
				id="recipe-grid"
				title="Recipe grid"
				description="One column on phones, two on tablets, three on desktop. Each card is a single link."
			>
				<RecipeGrid>
					{sampleRecipeCards.map((recipe) => (
						<li key={recipe.title}>
							<RecipeCard {...recipe} />
						</li>
					))}
				</RecipeGrid>
			</ReferenceSubsection>
			<ReferenceSubsection
				id="recipe-grid-loading"
				title="Recipe grid, loading"
				description="Skeletons hold the same layout while recipes load."
			>
				<div role="status">
					<span className="sr-only">Loading recipes</span>
					<RecipeGrid>
						{Array.from({ length: skeletonCount }, (_, index) => (
							<li key={index}>
								<RecipeCardSkeleton />
							</li>
						))}
					</RecipeGrid>
				</div>
			</ReferenceSubsection>
			<ReferenceSubsection
				id="recipe-detail"
				title="Recipe detail"
				description="Reading width, with ingredients and steps in text-lg."
			>
				<Specimen className="px-0 py-10 sm:py-14">
					<RecipeDetailExcerpt />
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
