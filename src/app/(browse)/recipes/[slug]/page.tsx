import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { Suspense } from 'react';
import { readForReader } from '@/app/_lib/read-for-reader';
import { getCachedRecipe, getCachedRecipePage } from '@/app/_lib/recipe-cache';
import { setFavorite } from '@/app/(browse)/favorites/actions';
import { CookingModeProvider } from '@/components/cooking/cooking-mode-provider';
import { FavoriteToggle } from '@/components/favorites/favorite-toggle';
import { PageContainer } from '@/components/layout/page-container';
import { RecipeBackLink } from '@/components/recipe/recipe-back-link';
import { RecipeDetail, RecipeDetailSkeleton } from '@/components/recipe/recipe-detail';
import { RecipeJsonLd } from '@/components/recipe/recipe-json-ld';
import { defaultListSort } from '@/components/recipe/recipe-list-params';
import { RecipeEditLink } from '@/components/recipe/recipe-member-view';
import { recipeMetaDescription } from '@/components/recipe/recipe-meta-description';
import { recipePath } from '@/components/recipe/recipe-paths';
import { Skeleton } from '@/components/ui/skeleton';
import { getFavoriteService, getRecipeService } from '@/composition/services';
import { siteUrl } from '@/lib/env';
import { getLogger } from '@/lib/logger';
import { siteName } from '@/lib/site';

const logger = getLogger('auth');

export async function generateStaticParams(): Promise<{ slug: string }[]> {
	const { recipes } = await getCachedRecipePage(1, defaultListSort);
	// A param is required but production starts empty; this one fails the slug schema and prerenders a 404.
	return recipes.length > 0 ? recipes.map(({ slug }) => ({ slug })) : [{ slug: '__placeholder__' }];
}

// Under an old slug too, this names the recipe's current URL, so previews of old links stay right.
export async function generateMetadata({
	params,
}: PageProps<'/recipes/[slug]'>): Promise<Metadata> {
	const { slug } = await params;
	const recipe = await getCachedRecipe(slug);
	// Gated here as well, so a missing recipe's 404 carries the not-found page's title.
	if (recipe === null) {
		notFound();
	}

	const path = recipePath(recipe.slug);
	const description = recipeMetaDescription(recipe);
	return {
		title: recipe.title,
		description,
		alternates: { canonical: path },
		// The opengraph-image file convention fills in the images.
		openGraph: {
			type: 'article',
			url: path,
			title: recipe.title,
			description,
			publishedTime: recipe.createdAt.toISOString(),
			modifiedTime: recipe.updatedAt.toISOString(),
			siteName,
		},
	};
}

async function RecipeEditAction({ slug }: { slug: string }) {
	const view = await readForReader(() => getRecipeService().getRecipeMemberView(slug), {
		log: (error) => logger.error('Edit link session read failed', { err: error }),
		fallback: null,
	});
	if (view === null || !view.canEdit) {
		return null;
	}

	return <RecipeEditLink slug={slug} />;
}

// Where the read fails, the box the actions reserve stays empty: a heart would guess the reader's
// favorite, and its change would fail on the same read.
async function RecipeFavoriteToggle({ recipeId }: { recipeId: string }) {
	const favorite = await readForReader(() => getFavoriteService().isFavorite(recipeId), {
		log: (error) => logger.error('Favorite toggle session read failed', { err: error }),
		fallback: null,
	});
	if (favorite === null) {
		return null;
	}

	return <FavoriteToggle recipeId={recipeId} favorite={favorite} setFavoriteAction={setFavorite} />;
}

// A part for one reader, such as the edit link or the favorite toggle, reads the session, so it
// streams in behind its own boundary and the recipe, scans included, stays in the prerendered shell;
// where the read fails, the part is left out and the recipe still shows. The toggle's placeholder
// fills the box the actions reserve for it.
async function RecipeBySlug({ params }: Pick<PageProps<'/recipes/[slug]'>, 'params'>) {
	const { slug } = await params;
	const recipe = await getCachedRecipe(slug);
	if (recipe === null) {
		notFound();
	}

	// Slugs follow titles, so an old one still finds the recipe. Inside Suspense the redirect happens
	// in the browser, where a permanent one leaves at once and a temporary one waits a second.
	if (recipe.slug !== slug) {
		permanentRedirect(recipePath(recipe.slug));
	}

	return (
		<>
			<RecipeJsonLd recipe={recipe} siteUrl={siteUrl} />
			<RecipeBackLink recipePathname={recipePath(recipe.slug)} className="mb-6" />
			<CookingModeProvider recipe={{ id: recipe.id, version: recipe.updatedAt.toISOString() }}>
				<RecipeDetail
					recipe={recipe}
					headingLevel={1}
					titleAction={
						<Suspense>
							<RecipeEditAction slug={recipe.slug} />
						</Suspense>
					}
					favoriteToggle={
						<Suspense fallback={<Skeleton />}>
							<RecipeFavoriteToggle recipeId={recipe.id} />
						</Suspense>
					}
				/>
			</CookingModeProvider>
		</>
	);
}

export default function RecipePage({ params }: PageProps<'/recipes/[slug]'>) {
	return (
		// Less above the title on phones, so more of the recipe shows on the first screen.
		<PageContainer width="reading" className="pt-6 pb-12 sm:py-16">
			<Suspense fallback={<RecipeDetailSkeleton />}>
				<RecipeBySlug params={params} />
			</Suspense>
		</PageContainer>
	);
}
