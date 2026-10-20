import { cn } from 'cn';
import * as React from 'react';
import type { RecipeSummaryDto } from '@/application/recipes/recipe-dtos';
import {
	RecipeListItem,
	RecipeListItemSkeleton,
	type RecipeHighlights,
	type RecipeListItemHeadingTag,
} from '@/components/recipe/recipe-list-item';
import { RecipeListLinks } from '@/components/recipe/recipe-list-links';

// A recipe in the list, with what a search's words matched in it, when searching with words.
type RecipeGridEntry = {
	recipe: RecipeSummaryDto;
	highlights?: RecipeHighlights;
};

// Enough to fill the first screen: the skeletons while recipes load, and the items whose photos load
// eagerly, since on desktop a second-row photo is the largest paint where the first row's cards have
// none.
const firstScreenItemCount = 6;

// Each grid's columns from sm, where its items are cards, and the width a card's photo takes in them,
// as RecipePhoto takes it. Below sm every grid is one column of rows.
const recipeGridLayouts = {
	// Across a wide container: two columns from sm, and three from lg, where a column is 352px.
	fullWidth: {
		columnsClassName: 'sm:grid-cols-2 lg:grid-cols-3',
		cardPhotoSizes: '(min-width: 1024px) 352px, (min-width: 640px) 50vw',
	},
	// Beside the Recipes page's sidebar, which takes 288px of a wide container from lg: two columns
	// from sm, 332px at 1024px and 396px at most, and three of 256px from xl.
	besideSidebar: {
		columnsClassName: 'sm:grid-cols-2 xl:grid-cols-3',
		cardPhotoSizes:
			'(min-width: 1280px) 256px, (min-width: 1024px) min(396px, 50vw - 180px), (min-width: 640px) 50vw',
	},
} as const;

type RecipeGridLayout = keyof typeof recipeGridLayouts;

function RecipeGridList({
	layout,
	children,
}: {
	layout: RecipeGridLayout;
	children: React.ReactNode;
}) {
	return (
		<ul
			role="list"
			className={cn('grid gap-3 sm:gap-6', recipeGridLayouts[layout].columnsClassName)}
		>
			{children}
		</ul>
	);
}

// The Recipes page's recipes beside its sidebar, and Favorites' across the page. Each item records
// the page, with the list's back label, as where its recipe is opened from.
function RecipeGrid({
	layout,
	entries,
	namesChapter,
	headingTag,
	backLabel,
}: {
	layout: RecipeGridLayout;
	entries: readonly RecipeGridEntry[];
	// Outside a chapter, so each item names its recipe's.
	namesChapter: boolean;
	headingTag: RecipeListItemHeadingTag;
	backLabel: string;
}) {
	return (
		<RecipeListLinks backLabel={backLabel}>
			<RecipeGridList layout={layout}>
				{entries.map(({ recipe, highlights }, index) => (
					<li key={recipe.id}>
						<RecipeListItem
							recipe={recipe}
							highlights={highlights}
							namesChapter={namesChapter}
							headingTag={headingTag}
							cardPhotoSizes={recipeGridLayouts[layout].cardPhotoSizes}
							eager={index < firstScreenItemCount}
						/>
					</li>
				))}
			</RecipeGridList>
		</RecipeListLinks>
	);
}

// The items' places, inside a region that announces the loading.
function RecipeGridSkeletonItems({ layout }: { layout: RecipeGridLayout }) {
	return (
		<RecipeGridList layout={layout}>
			{Array.from({ length: firstScreenItemCount }, (_, index) => (
				<li key={index}>
					<RecipeListItemSkeleton />
				</li>
			))}
		</RecipeGridList>
	);
}

function RecipeGridSkeleton({ layout }: { layout: RecipeGridLayout }) {
	return (
		<div role="status" aria-live="polite">
			<span className="sr-only">Loading recipes</span>
			<RecipeGridSkeletonItems layout={layout} />
		</div>
	);
}

export { RecipeGrid, RecipeGridSkeleton, RecipeGridSkeletonItems };
