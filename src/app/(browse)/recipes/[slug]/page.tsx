import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { getCachedRecipe, getCachedRecipePage } from '@/app/_lib/recipe-cache';
import { PageContainer } from '@/components/layout/page-container';
import { siteName } from '@/components/layout/site-name';
import { RecipeDetail, RecipeDetailSkeleton } from '@/components/recipe/recipe-detail';
import { RecipeJsonLd } from '@/components/recipe/recipe-json-ld';
import { defaultListSort } from '@/components/recipe/recipe-list-params';
import { recipePath } from '@/components/recipe/recipe-paths';
import { siteUrl } from '@/lib/env';

export async function generateStaticParams(): Promise<{ slug: string }[]> {
	const { recipes } = await getCachedRecipePage(1, defaultListSort);
	// A param is required but production starts empty; this one fails the slug schema and prerenders a 404.
	return recipes.length > 0 ? recipes.map(({ slug }) => ({ slug })) : [{ slug: '__placeholder__' }];
}

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
	return {
		title: recipe.title,
		description: recipe.description,
		alternates: { canonical: path },
		// The opengraph-image file convention fills in the images.
		openGraph: {
			type: 'article',
			url: path,
			title: recipe.title,
			description: recipe.description,
			publishedTime: recipe.createdAt.toISOString(),
			modifiedTime: recipe.updatedAt.toISOString(),
			siteName,
		},
		twitter: { card: 'summary_large_image' },
	};
}

async function RecipeBySlug({ params }: Pick<PageProps<'/recipes/[slug]'>, 'params'>) {
	const { slug } = await params;
	const recipe = await getCachedRecipe(slug);
	if (recipe === null) {
		notFound();
	}

	return (
		<>
			<RecipeJsonLd recipe={recipe} siteUrl={siteUrl} />
			<RecipeDetail recipe={recipe} headingLevel={1} />
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
