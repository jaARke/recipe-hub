import * as React from 'react';
import { RecipeCardSkeleton } from '@/components/recipe/recipe-card';
import { RecipeListLinks } from '@/components/recipe/recipe-list-links';

// The desktop grid's first row, which is above the fold.
const firstRowCardCount = 3;

// Two rows on desktop, enough to fill the first screen while recipes load.
const skeletonCardCount = 6;

// Browse's and Favorites' cards, each recording the page as where its recipe is opened from.
function RecipeGrid({ children }: { children: React.ReactNode }) {
	return (
		<RecipeListLinks>
			<ul role="list" className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
				{children}
			</ul>
		</RecipeListLinks>
	);
}

function RecipeGridSkeleton() {
	return (
		<div role="status" aria-live="polite">
			<span className="sr-only">Loading recipes</span>
			<RecipeGrid>
				{Array.from({ length: skeletonCardCount }, (_, index) => (
					<li key={index}>
						<RecipeCardSkeleton />
					</li>
				))}
			</RecipeGrid>
		</div>
	);
}

export { firstRowCardCount, RecipeGrid, RecipeGridSkeleton };
