import { cn } from 'cn';
import Link from 'next/link';
import * as React from 'react';
import type { RecipeSummaryDto } from '@/application/recipes/recipe-dtos';
import type { RecipeSearchResultDto } from '@/application/search/recipe-search-dtos';
import { describedBy } from '@/components/forms/described-by';
import { recipePath } from '@/components/recipe/recipe-paths';
import {
	RecipeBadges,
	recipeBadges,
	RecipeCover,
	RecipeFacts,
	recipeFacts,
} from '@/components/recipe/recipe-summary';
import { HighlightedSegments } from '@/components/search/highlighted-segments';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { chapterLabels } from '@/domain/recipe/chapter';

// What a search's words matched in a recipe, marked: its title, and the passage that matched.
type RecipeHighlights = Pick<RecipeSearchResultDto, 'title' | 'snippet'>;

// Level 4 and 5 nest an item under the design reference's own headings.
type RecipeListItemHeadingTag = 'h2' | 'h3' | 'h4' | 'h5';

// Below sm a row, its photo beside the words, so a phone shows several at once; from sm a card, its
// photo flush with the top edge.
const shellClassName = 'h-full flex-row gap-4 p-3 sm:flex-col sm:gap-0 sm:p-0';
const photoClassName = 'w-28 shrink-0 self-start rounded-lg sm:w-full sm:rounded-none';
const wordsClassName = 'flex min-w-0 flex-1 flex-col sm:p-6';
const wordsGapClassName = 'gap-1.5 sm:gap-3';

// The row's photo box, w-28, as RecipePhoto's sizes take it.
const rowPhotoSize = '112px';

// One link to the recipe, named by its title. Outside a chapter it names the recipe's chapter above
// the title, and searching with words it marks what they matched. Eager for items above the fold,
// whose photo may be the largest paint; the rest load as they scroll in.
function RecipeListItem({
	recipe,
	highlights,
	namesChapter,
	headingTag: Heading,
	cardPhotoSizes,
	eager = false,
}: {
	recipe: RecipeSummaryDto;
	highlights?: RecipeHighlights;
	namesChapter: boolean;
	headingTag: RecipeListItemHeadingTag;
	// The card's photo width from sm, in the grid it sits in; the row's follows.
	cardPhotoSizes: string;
	eager?: boolean;
}) {
	const baseId = React.useId();
	const facts = recipeFacts(recipe);
	const badges = recipeBadges(recipe);
	const hasDetails = facts.length > 0 || badges.length > 0;
	const snippet = highlights?.snippet;
	const ids = {
		chapter: namesChapter ? `${baseId}-chapter` : undefined,
		title: `${baseId}-title`,
		source: recipe.source === undefined ? undefined : `${baseId}-source`,
		snippet: snippet === undefined ? undefined : `${baseId}-snippet`,
		details: hasDetails ? `${baseId}-details` : undefined,
	};

	return (
		<Link
			href={recipePath(recipe.slug)}
			aria-labelledby={ids.title}
			aria-describedby={describedBy(ids.chapter, ids.source, ids.snippet, ids.details)}
			className="block h-full rounded-xl transition-shadow hover:shadow-md"
		>
			{/* The dark theme's edge is dimmer than its text and hides a shadow, so hovered it brightens to
			    the text's color. */}
			<Card className={cn(shellClassName, 'transition-shadow hover:ring-foreground')}>
				<RecipeCover
					image={recipe.coverImage}
					sizes={`${cardPhotoSizes}, ${rowPhotoSize}`}
					eager={eager}
					className={photoClassName}
				/>
				<div className={cn(wordsClassName, wordsGapClassName)}>
					{ids.chapter !== undefined && (
						<p
							id={ids.chapter}
							className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
						>
							{chapterLabels[recipe.chapter]}
						</p>
					)}
					<CardTitle className="text-lg leading-snug">
						<Heading id={ids.title}>
							{highlights === undefined ? (
								recipe.title
							) : (
								<HighlightedSegments text={highlights.title} />
							)}
						</Heading>
					</CardTitle>
					{recipe.source !== undefined && (
						<CardDescription id={ids.source}>From {recipe.source}</CardDescription>
					)}
					{snippet !== undefined && (
						<p id={ids.snippet} className="line-clamp-3">
							<HighlightedSegments text={snippet} />
						</p>
					)}
					{hasDetails && (
						<div id={ids.details} className={cn('flex flex-col', wordsGapClassName)}>
							{facts.length > 0 && <RecipeFacts facts={facts} />}
							{badges.length > 0 && <RecipeBadges badges={badges} />}
						</div>
					)}
				</div>
			</Card>
		</Link>
	);
}

function RecipeListItemSkeleton() {
	return (
		// Purely visual: the loading region that renders skeletons announces the loading state.
		<Card aria-hidden="true" className={shellClassName}>
			<Skeleton className={cn('aspect-4/3', photoClassName)} />
			<div className={cn(wordsClassName, wordsGapClassName)}>
				<Skeleton className="h-4 w-1/3" />
				<Skeleton className="h-6 w-3/4" />
				<Skeleton className="h-5 w-1/2" />
				<Skeleton className="h-4 w-2/5" />
			</div>
		</Card>
	);
}

export {
	RecipeListItem,
	RecipeListItemSkeleton,
	type RecipeHighlights,
	type RecipeListItemHeadingTag,
};
