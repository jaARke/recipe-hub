import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { Suspense } from 'react';
import { getCachedRecipe, recipeStaticParams } from '@/app/_lib/recipe-cache';
import { cookingRecipeFrom } from '@/components/cooking/cooking-screens';
import { CookingView, CookingViewSkeleton } from '@/components/cooking/cooking-view';
import { recipeCookPath, recipePath } from '@/components/recipe/recipe-paths';

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

async function CookingViewBySlug({ params }: Pick<PageProps<'/recipes/[slug]/cook'>, 'params'>) {
	const { slug } = await params;
	const recipe = await getCachedRecipe(slug);
	if (recipe === null) {
		notFound();
	}

	// An old slug still finds the recipe, as on its page; the redirect happens in the browser.
	if (recipe.slug !== slug) {
		permanentRedirect(recipeCookPath(recipe.slug));
	}

	return <CookingView recipe={cookingRecipeFrom(recipe)} />;
}

// Outside the site's chrome, so the view has the whole screen. Its root renders the main landmark
// the skip link targets.
export default function CookingPage({ params }: PageProps<'/recipes/[slug]/cook'>) {
	return (
		<Suspense fallback={<CookingViewSkeleton />}>
			<CookingViewBySlug params={params} />
		</Suspense>
	);
}
