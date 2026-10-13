import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { cache, Suspense } from 'react';
import { getCachedRecipe, getCachedRecipePage } from '@/app/_lib/recipe-cache';
import { PageContainer } from '@/components/layout/page-container';
import { RecipeDetail, RecipeDetailSkeleton } from '@/components/recipe/recipe-detail';
import { RecipeJsonLd } from '@/components/recipe/recipe-json-ld';
import { defaultListSort } from '@/components/recipe/recipe-list-params';
import { RecipeEditLink, RecipeScans } from '@/components/recipe/recipe-member-view';
import { recipeMetaDescription } from '@/components/recipe/recipe-meta-description';
import { recipePath } from '@/components/recipe/recipe-paths';
import { getRecipeService } from '@/composition/services';
import { siteUrl } from '@/lib/env';
import { siteName } from '@/lib/site';

// Read once per request for both the edit link and the scans; null for a signed-out visitor.
const getRecipeMemberView = cache((slug: string) => getRecipeService().getRecipeMemberView(slug));

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
	const view = await getRecipeMemberView(slug);
	if (view === null || !view.canEdit) {
		return null;
	}

	return <RecipeEditLink slug={slug} />;
}

async function RecipeOriginalScans({ slug }: { slug: string }) {
	const view = await getRecipeMemberView(slug);
	if (view === null || view.scans.length === 0) {
		return null;
	}

	return <RecipeScans scans={view.scans} />;
}

// The members' parts read the session, so each streams in behind its own boundary and the recipe
// stays in the prerendered shell.
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
			<RecipeDetail
				recipe={recipe}
				headingLevel={1}
				titleAction={
					<Suspense>
						<RecipeEditAction slug={recipe.slug} />
					</Suspense>
				}
			/>
			<Suspense>
				<RecipeOriginalScans slug={recipe.slug} />
			</Suspense>
		</>
	);
}

export default function RecipePage({ params }: PageProps<'/recipes/[slug]'>) {
	return (
		<PageContainer width="reading" className="py-12 sm:py-16">
			<Suspense fallback={<RecipeDetailSkeleton />}>
				<RecipeBySlug params={params} />
			</Suspense>
		</PageContainer>
	);
}
