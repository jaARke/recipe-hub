import Link from 'next/link';
import type { RecipeSummaryDto } from '@/application/recipes/recipe-dtos';
import { describedBy } from '@/components/forms/described-by';
import { recipePath } from '@/components/recipe/recipe-paths';
import {
	RecipeCover,
	RecipeFacts,
	recipeFacts,
	RecipeTags,
} from '@/components/recipe/recipe-summary';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

// Level 4 nests a card under the design reference's own headings.
type CardHeadingTag = 'h2' | 'h4';

// Eager for cards above the fold, whose photo may be the largest paint; the rest load as they scroll in.
function RecipeCard({
	recipe,
	headingTag: Heading,
	photoSizes,
	eager = false,
}: {
	recipe: RecipeSummaryDto;
	headingTag: CardHeadingTag;
	// The photo's width in the grid the card sits in.
	photoSizes: string;
	eager?: boolean;
}) {
	const facts = recipeFacts(recipe);
	const hasDetails = facts.length > 0 || recipe.tags.length > 0;
	const titleId = `${recipe.slug}-card-title`;
	const sourceId = recipe.source === undefined ? undefined : `${recipe.slug}-card-source`;
	const detailsId = hasDetails ? `${recipe.slug}-card-details` : undefined;

	return (
		<Link
			href={recipePath(recipe.slug)}
			aria-labelledby={titleId}
			aria-describedby={describedBy(sourceId, detailsId)}
			className="block h-full rounded-xl transition-shadow hover:shadow-md"
		>
			{/* The photo box sits flush with the top edge, as the card does for an image first child. */}
			<Card className="h-full pt-0">
				<RecipeCover image={recipe.coverImage} sizes={photoSizes} eager={eager} />
				<CardHeader>
					<CardTitle>
						<Heading id={titleId}>{recipe.title}</Heading>
					</CardTitle>
					{recipe.source !== undefined && (
						<CardDescription id={sourceId}>From {recipe.source}</CardDescription>
					)}
				</CardHeader>
				{hasDetails && (
					<CardContent id={detailsId} className="mt-auto">
						{facts.length > 0 && <RecipeFacts facts={facts} />}
						{recipe.tags.length > 0 && <RecipeTags tags={recipe.tags} />}
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

export { RecipeCard, RecipeCardSkeleton, type CardHeadingTag };
