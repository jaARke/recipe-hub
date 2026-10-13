import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { getCachedRecipePage, recipesPerPage } from '@/app/_lib/recipe-cache';
import { recipeSorts } from '@/application/ports/recipe-repository';
import { PageContainer } from '@/components/layout/page-container';
import { RecipeCard } from '@/components/recipe/recipe-card';
import { firstRowCardCount, RecipeGrid, RecipeGridSkeleton } from '@/components/recipe/recipe-grid';
import { RecipeListHeading } from '@/components/recipe/recipe-list-heading';
import { parseRecipeListParams, recipeListHref } from '@/components/recipe/recipe-list-params';
import { RecipePagination } from '@/components/recipe/recipe-pagination';
import { recipeListPath } from '@/components/recipe/recipe-paths';
import { RecipeSortForm, RecipeSortFormSkeleton } from '@/components/recipe/recipe-sort-form';
import { RecipesEmptyState } from '@/components/recipe/recipes-empty-state';

// The page's heading, which takes focus when the pagination changes the page.
const recipesHeadingId = 'recipes-heading';

// Every page names its normalized URL, so /?page=1 points at /.
export async function generateMetadata({ searchParams }: PageProps<'/'>): Promise<Metadata> {
	const state = parseRecipeListParams(await searchParams);
	return state === null ? {} : { alternates: { canonical: recipeListHref(state) } };
}

async function RecipeList({ searchParams }: Pick<PageProps<'/'>, 'searchParams'>) {
	const state = parseRecipeListParams(await searchParams);
	if (state === null) {
		notFound();
	}

	// The first page carries the total, so a page past the end never reaches the database.
	const firstPage = await getCachedRecipePage(1, state.sort);
	const pageCount = Math.max(1, Math.ceil(firstPage.total / recipesPerPage));
	if (state.page > pageCount) {
		notFound();
	}

	const { recipes } =
		state.page === 1 ? firstPage : await getCachedRecipePage(state.page, state.sort);
	if (recipes.length === 0) {
		return <RecipesEmptyState />;
	}

	return (
		<>
			<div className="flex justify-end">
				<RecipeSortForm
					id="recipe-sort"
					action={recipeListPath}
					sorts={recipeSorts}
					value={state.sort}
				/>
			</div>
			<RecipeGrid>
				{recipes.map((recipe, index) => (
					<li key={recipe.id}>
						<RecipeCard recipe={recipe} headingTag="h2" eager={index < firstRowCardCount} />
					</li>
				))}
			</RecipeGrid>
			{pageCount > 1 && (
				<RecipePagination
					page={state.page}
					pageCount={pageCount}
					pageHref={(page) => recipeListHref({ page, sort: state.sort })}
					resultsHeadingId={recipesHeadingId}
				/>
			)}
		</>
	);
}

export default function RecipesPage({ searchParams }: PageProps<'/'>) {
	return (
		<PageContainer width="wide" className="flex flex-col gap-8 py-12 sm:py-16">
			<RecipeListHeading id={recipesHeadingId}>Recipes</RecipeListHeading>
			<Suspense
				fallback={
					<>
						<div className="flex justify-end">
							<RecipeSortFormSkeleton />
						</div>
						<RecipeGridSkeleton />
					</>
				}
			>
				<RecipeList searchParams={searchParams} />
			</Suspense>
		</PageContainer>
	);
}
