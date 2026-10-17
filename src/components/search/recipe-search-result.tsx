import Link from 'next/link';
import * as React from 'react';
import type { RecipeSearchResultDto } from '@/application/search/recipe-search-dtos';
import { describedBy } from '@/components/forms/described-by';
import { RecipeListLinks } from '@/components/recipe/recipe-list-links';
import { recipePath } from '@/components/recipe/recipe-paths';
import {
	RecipeCover,
	RecipeFacts,
	recipeFacts,
	RecipeTags,
} from '@/components/recipe/recipe-summary';
import { HighlightedSegments } from '@/components/search/highlighted-segments';
import { Skeleton } from '@/components/ui/skeleton';

// The photo box is 96px wide on phones and 160px from sm.
const resultPhotoSizes = '(min-width: 640px) 160px, 96px';

// The first results, which are above the fold on a desktop.
const firstResultCount = 3;

// Each result records the page, query and filters included, as where its recipe is opened from.
function RecipeSearchResultList({ children }: { children: React.ReactNode }) {
	return (
		<RecipeListLinks>
			<ul role="list" className="divide-y">
				{children}
			</ul>
		</RecipeListLinks>
	);
}

// Level 5 nests a result under the design reference's own headings.
type ResultHeadingTag = 'h3' | 'h5';

function RecipeSearchResult({
	result,
	headingTag: Heading,
	eager = false,
}: {
	result: RecipeSearchResultDto;
	headingTag: ResultHeadingTag;
	eager?: boolean;
}) {
	const { recipe } = result;
	const facts = recipeFacts(recipe);
	const hasDetails = facts.length > 0 || recipe.tags.length > 0;
	const titleId = `${recipe.slug}-result-title`;
	const sourceId = recipe.source === undefined ? undefined : `${recipe.slug}-result-source`;
	const snippetId = result.snippet === undefined ? undefined : `${recipe.slug}-result-snippet`;
	const detailsId = hasDetails ? `${recipe.slug}-result-details` : undefined;

	return (
		<Link
			href={recipePath(recipe.slug)}
			aria-labelledby={titleId}
			aria-describedby={describedBy(sourceId, snippetId, detailsId)}
			className="group flex gap-4 py-4 sm:gap-6"
		>
			<RecipeCover
				image={recipe.coverImage}
				sizes={resultPhotoSizes}
				eager={eager}
				className="w-24 shrink-0 self-start rounded-md sm:w-40"
			/>
			<div className="flex min-w-0 flex-1 flex-col gap-1">
				<Heading
					id={titleId}
					className="line-clamp-2 font-heading text-lg font-semibold underline-offset-4 group-hover:underline"
				>
					<HighlightedSegments text={result.title} />
				</Heading>
				{recipe.source !== undefined && (
					<p id={sourceId} className="text-sm text-muted-foreground">
						From {recipe.source}
					</p>
				)}
				{result.snippet !== undefined && (
					<p id={snippetId} className="line-clamp-2 text-sm text-muted-foreground">
						<HighlightedSegments text={result.snippet} />
					</p>
				)}
				{hasDetails && (
					<div id={detailsId} className="mt-2 flex flex-col gap-2">
						{facts.length > 0 && <RecipeFacts facts={facts} />}
						{recipe.tags.length > 0 && <RecipeTags tags={recipe.tags} />}
					</div>
				)}
			</div>
		</Link>
	);
}

function RecipeSearchResultSkeleton() {
	return (
		// Purely visual: the loading region that renders skeletons announces the loading state.
		<div aria-hidden="true" className="flex gap-4 py-4 sm:gap-6">
			<Skeleton className="aspect-4/3 w-24 shrink-0 self-start rounded-md sm:w-40" />
			<div className="flex min-w-0 flex-1 flex-col gap-1">
				<Skeleton className="h-7 w-2/3" />
				<Skeleton className="h-5 w-1/3" />
				<Skeleton className="h-5 w-full" />
				<Skeleton className="h-5 w-4/5" />
				<div className="mt-2 flex flex-col gap-2">
					<Skeleton className="h-4 w-1/3" />
					<div className="flex gap-1.5">
						<Skeleton className="h-5 w-16 rounded-4xl" />
						<Skeleton className="h-5 w-20 rounded-4xl" />
					</div>
				</div>
			</div>
		</div>
	);
}

export { firstResultCount, RecipeSearchResult, RecipeSearchResultList, RecipeSearchResultSkeleton };
