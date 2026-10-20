import { cn } from 'cn';
import * as React from 'react';
import type { RecipeSummaryDto } from '@/application/recipes/recipe-dtos';
import {
	RecipeCard,
	RecipeCardSkeleton,
	type CardHeadingTag,
} from '@/components/recipe/recipe-card';
import { RecipeListLinks } from '@/components/recipe/recipe-list-links';

// Two rows on desktop, enough to fill the first screen: the skeletons while recipes load, and the
// cards whose photos load eagerly, since a second-row photo is the largest paint where the first
// row's cards have none.
const firstScreenCardCount = 6;

// Each grid's columns, and the width a card's photo takes in them, as RecipePhoto takes it.
const recipeGridLayouts = {
	// Across a wide container: two columns from sm, and three from lg, where a column is 352px.
	fullWidth: {
		columnsClassName: 'sm:grid-cols-2 lg:grid-cols-3',
		photoSizes: '(min-width: 1024px) 352px, (min-width: 640px) 50vw, 100vw',
	},
	// Beside the filters' sidebar, which takes 288px of a wide container from lg: two columns from sm,
	// 332px at 1024px and 396px at most, and three of 256px from xl.
	besideSidebar: {
		columnsClassName: 'sm:grid-cols-2 xl:grid-cols-3',
		photoSizes:
			'(min-width: 1280px) 256px, (min-width: 1024px) min(396px, 50vw - 180px), (min-width: 640px) 50vw, 100vw',
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
		<ul role="list" className={cn('grid gap-6', recipeGridLayouts[layout].columnsClassName)}>
			{children}
		</ul>
	);
}

// Browse's cards beside its filters, and Favorites' across the page. Each card records the page, with
// the list's back label, as where its recipe is opened from.
function RecipeGrid({
	layout,
	recipes,
	headingTag,
	backLabel,
}: {
	layout: RecipeGridLayout;
	recipes: readonly RecipeSummaryDto[];
	headingTag: CardHeadingTag;
	backLabel: string;
}) {
	return (
		<RecipeListLinks backLabel={backLabel}>
			<RecipeGridList layout={layout}>
				{recipes.map((recipe, index) => (
					<li key={recipe.id}>
						<RecipeCard
							recipe={recipe}
							headingTag={headingTag}
							photoSizes={recipeGridLayouts[layout].photoSizes}
							eager={index < firstScreenCardCount}
						/>
					</li>
				))}
			</RecipeGridList>
		</RecipeListLinks>
	);
}

// The cards' places, inside a region that announces the loading.
function RecipeGridSkeletonCards({ layout }: { layout: RecipeGridLayout }) {
	return (
		<RecipeGridList layout={layout}>
			{Array.from({ length: firstScreenCardCount }, (_, index) => (
				<li key={index}>
					<RecipeCardSkeleton />
				</li>
			))}
		</RecipeGridList>
	);
}

function RecipeGridSkeleton({ layout }: { layout: RecipeGridLayout }) {
	return (
		<div role="status" aria-live="polite">
			<span className="sr-only">Loading recipes</span>
			<RecipeGridSkeletonCards layout={layout} />
		</div>
	);
}

export { RecipeGrid, RecipeGridSkeleton, RecipeGridSkeletonCards };
