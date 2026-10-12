import { CookingPotIcon } from 'lucide-react';
import Link from 'next/link';
import type { RecipeSummaryDto } from '@/application/recipes/recipe-dtos';
import { recipePath } from '@/components/recipe/recipe-paths';
import { RecipePhoto } from '@/components/recipe/recipe-photo';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDuration } from '@/domain/recipe/duration';
import type { RecipeImage } from '@/domain/recipe/recipe-image';
import { formatYield } from '@/domain/recipe/recipe-yield';

type RecipeCardFact = {
	label: string;
	value: string;
};

// One column on phones, two from sm, and three from lg, where a wide container's column is 352px.
const cardPhotoSizes = '(min-width: 1024px) 352px, (min-width: 640px) 50vw, 100vw';

function cardFacts({ totalMinutes, yield: recipeYield }: RecipeSummaryDto): RecipeCardFact[] {
	const facts: RecipeCardFact[] = [];
	if (totalMinutes !== undefined) {
		facts.push({ label: 'Total time', value: formatDuration(totalMinutes) });
	}
	if (recipeYield !== undefined) {
		facts.push({ label: 'Yield', value: formatYield(recipeYield) });
	}
	return facts;
}

function RecipeCardPhoto({ image, eager }: { image: RecipeImage | undefined; eager: boolean }) {
	if (image === undefined) {
		return (
			// The same box without a photo, so every card in a row lines up.
			<div className="flex aspect-4/3 items-center justify-center bg-muted text-muted-foreground">
				<CookingPotIcon className="size-8" aria-hidden="true" />
			</div>
		);
	}

	return (
		<RecipePhoto
			pathname={image.pathname}
			// Decorative, so the card's link is named by its title alone.
			alt=""
			sizes={cardPhotoSizes}
			loading={eager ? 'eager' : 'lazy'}
			className="aspect-4/3"
		/>
	);
}

// Eager for cards above the fold, whose photo may be the largest paint; the rest load as they scroll in.
function RecipeCard({ recipe, eager = false }: { recipe: RecipeSummaryDto; eager?: boolean }) {
	const facts = cardFacts(recipe);

	return (
		<Link
			href={recipePath(recipe.slug)}
			className="block h-full rounded-xl transition-shadow hover:shadow-md"
		>
			{/* The photo box sits flush with the top edge, as the card does for an image first child. */}
			<Card className="h-full pt-0">
				<RecipeCardPhoto image={recipe.coverImage} eager={eager} />
				<CardHeader>
					<CardTitle>{recipe.title}</CardTitle>
					{recipe.source !== undefined && <CardDescription>From {recipe.source}</CardDescription>}
				</CardHeader>
				{(facts.length > 0 || recipe.tags.length > 0) && (
					<CardContent className="mt-auto">
						{facts.length > 0 && (
							<dl className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs tracking-wide text-muted-foreground uppercase">
								{facts.map((fact) => (
									<div key={fact.label}>
										<dt className="sr-only">{fact.label}</dt>
										<dd>{fact.value}</dd>
									</div>
								))}
							</dl>
						)}
						{recipe.tags.length > 0 && (
							<ul className="flex flex-wrap gap-1.5">
								{recipe.tags.map((tag) => (
									<li key={tag}>
										<Badge variant="secondary">{tag}</Badge>
									</li>
								))}
							</ul>
						)}
					</CardContent>
				)}
			</Card>
		</Link>
	);
}

function RecipeCardSkeleton() {
	return (
		// Purely visual: the loading region that renders skeletons announces the loading state.
		<Card aria-hidden="true" className="h-full pt-0">
			<Skeleton className="aspect-4/3 rounded-none" />
			<CardHeader>
				<Skeleton className="h-6 w-3/4" />
				<Skeleton className="h-5 w-1/3" />
			</CardHeader>
			<CardContent className="mt-auto">
				<Skeleton className="h-4 w-1/2" />
				<div className="flex gap-1.5">
					<Skeleton className="h-5 w-16 rounded-4xl" />
					<Skeleton className="h-5 w-20 rounded-4xl" />
				</div>
			</CardContent>
		</Card>
	);
}

export { RecipeCard, RecipeCardSkeleton };
