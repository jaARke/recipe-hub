import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { getCachedRecipePage, recipesPerPage } from '@/app/_lib/recipe-cache';
import { PageContainer } from '@/components/layout/page-container';
import { RecipeCard } from '@/components/recipe/recipe-card';
import { firstRowCardCount, RecipeGrid, RecipeGridSkeleton } from '@/components/recipe/recipe-grid';
import { RecipePagination } from '@/components/recipe/recipe-pagination';
import { RecipesEmptyState } from '@/components/recipe/recipes-empty-state';

// The first page has no query; any other page is a plain positive number.
function parsePageNumber(value: string | string[] | undefined): number | null {
	if (value === undefined) {
		return 1;
	}

	return typeof value === 'string' && /^[1-9]\d*$/.test(value) ? Number(value) : null;
}

async function RecipeList({ searchParams }: Pick<PageProps<'/'>, 'searchParams'>) {
	const page = parsePageNumber((await searchParams).page);
	if (page === null) {
		notFound();
	}

	// The first page carries the total, so a page past the end never reaches the database.
	const firstPage = await getCachedRecipePage(1);
	const pageCount = Math.max(1, Math.ceil(firstPage.total / recipesPerPage));
	if (page > pageCount) {
		notFound();
	}

	const { recipes } = page === 1 ? firstPage : await getCachedRecipePage(page);
	if (recipes.length === 0) {
		return <RecipesEmptyState />;
	}

	return (
		<>
			<RecipeGrid>
				{recipes.map((recipe, index) => (
					<li key={recipe.id}>
						<RecipeCard recipe={recipe} eager={index < firstRowCardCount} />
					</li>
				))}
			</RecipeGrid>
			{pageCount > 1 && <RecipePagination page={page} pageCount={pageCount} />}
		</>
	);
}

export default function RecipesPage({ searchParams }: PageProps<'/'>) {
	return (
		<PageContainer width="wide" className="flex flex-col gap-8 py-12 sm:py-16">
			<h1 className="font-heading text-4xl font-medium">Recipes</h1>
			<Suspense fallback={<RecipeGridSkeleton />}>
				<RecipeList searchParams={searchParams} />
			</Suspense>
		</PageContainer>
	);
}
