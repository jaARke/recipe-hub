import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { InvalidRecipePageError } from '@/application/recipes/errors';
import type { RecipeSummaryPage } from '@/application/recipes/recipe-dtos';
import { FavoritesEmptyState } from '@/components/favorites/favorites-empty-state';
import { PageContainer } from '@/components/layout/page-container';
import { RecipeCard } from '@/components/recipe/recipe-card';
import { firstRowCardCount, RecipeGrid, RecipeGridSkeleton } from '@/components/recipe/recipe-grid';
import { RecipeListHeading } from '@/components/recipe/recipe-list-heading';
import { favoriteListHref, parsePageParam } from '@/components/recipe/recipe-list-params';
import { RecipePagination } from '@/components/recipe/recipe-pagination';
import { recipeListParamNames } from '@/components/recipe/recipe-paths';
import { getFavoriteService } from '@/composition/services';
import { settings } from '@/lib/settings';

// Each reader's own list, so it stays out of search engines; its links are followed.
export const metadata: Metadata = {
	title: 'Favorites',
	robots: { index: false, follow: true },
};

// The page's heading, which takes focus when the pagination changes the page.
const favoritesHeadingId = 'favorites-heading';

// A page too far out for the service, like any other page past the end, is a bad URL.
async function listFavorites(page: number): Promise<RecipeSummaryPage> {
	const { recipesPerPage } = settings.display;
	try {
		return await getFavoriteService().listFavorites({
			limit: recipesPerPage,
			offset: (page - 1) * recipesPerPage,
		});
	} catch (error) {
		if (error instanceof InvalidRecipePageError) {
			notFound();
		}
		throw error;
	}
}

// Not cached: a member's favorites live in their account and a signed-out reader's on their device,
// so the list is read for each request, newest first.
async function FavoriteList({ searchParams }: Pick<PageProps<'/favorites'>, 'searchParams'>) {
	const page = parsePageParam((await searchParams)[recipeListParamNames.page]);
	if (page === null) {
		notFound();
	}

	const { recipes, total } = await listFavorites(page);
	const pageCount = Math.max(1, Math.ceil(total / settings.display.recipesPerPage));
	if (page > pageCount) {
		notFound();
	}

	if (recipes.length === 0) {
		return <FavoritesEmptyState />;
	}

	return (
		<>
			<RecipeGrid>
				{recipes.map((recipe, index) => (
					<li key={recipe.id}>
						<RecipeCard recipe={recipe} headingTag="h2" eager={index < firstRowCardCount} />
					</li>
				))}
			</RecipeGrid>
			{pageCount > 1 && (
				<RecipePagination
					page={page}
					pageCount={pageCount}
					pageHref={favoriteListHref}
					resultsHeadingId={favoritesHeadingId}
				/>
			)}
		</>
	);
}

export default function FavoritesPage({ searchParams }: PageProps<'/favorites'>) {
	return (
		<PageContainer width="wide" className="flex flex-col gap-8 py-12 sm:py-16">
			<RecipeListHeading id={favoritesHeadingId}>Favorites</RecipeListHeading>
			<Suspense fallback={<RecipeGridSkeleton />}>
				<FavoriteList searchParams={searchParams} />
			</Suspense>
		</PageContainer>
	);
}
