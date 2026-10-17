import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { Suspense } from 'react';
import { getCachedRecipe, recipeStaticParams } from '@/app/_lib/recipe-cache';
import { cookingRecipeFrom, cookingViewParams } from '@/components/cooking/cooking-screens';
import { CookingView, CookingViewSkeleton } from '@/components/cooking/cooking-view';
import { recipeCookPath, recipePath } from '@/components/recipe/recipe-paths';
import { hrefWithParams } from '@/lib/url-query';

export function generateStaticParams(): Promise<{ slug: string }[]> {
	return recipeStaticParams();
}

// The view is a way of reading the recipe's page, so search engines are pointed there and never
// list the view itself.
export async function generateMetadata({
	params,
}: PageProps<'/recipes/[slug]/cook'>): Promise<Metadata> {
	const { slug } = await params;
	const recipe = await getCachedRecipe(slug);
	// Gated here as well, so a missing recipe's 404 carries the not-found page's title.
	if (recipe === null) {
		notFound();
	}

	return {
		title: `Cooking ${recipe.title}`,
		alternates: { canonical: recipePath(recipe.slug) },
		robots: { index: false },
	};
}

async function CookingViewBySlug({
	params,
	searchParams,
}: Pick<PageProps<'/recipes/[slug]/cook'>, 'params' | 'searchParams'>) {
	const { slug } = await params;
	const recipe = await getCachedRecipe(slug);
	if (recipe === null) {
		notFound();
	}

	// An old slug still finds the recipe, as on its page; the redirect happens in the browser and keeps
	// the cook's step and scale. Only an old slug reads the query, so a current one stays prerendered.
	if (recipe.slug !== slug) {
		const kept = cookingViewParams(await searchParams, recipe.yield);
		permanentRedirect(hrefWithParams(recipeCookPath(recipe.slug), kept));
	}

	return <CookingView recipe={cookingRecipeFrom(recipe)} />;
}

// Outside the site's chrome, so the view has the whole screen. Its root renders the main landmark
// the skip link targets.
export default function CookingPage({ params, searchParams }: PageProps<'/recipes/[slug]/cook'>) {
	return (
		<Suspense fallback={<CookingViewSkeleton />}>
			<CookingViewBySlug params={params} searchParams={searchParams} />
		</Suspense>
	);
}
