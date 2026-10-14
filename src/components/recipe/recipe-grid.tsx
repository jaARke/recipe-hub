import * as React from 'react';
import { RecipeCardSkeleton } from '@/components/recipe/recipe-card';

// The desktop grid's first row, which is above the fold.
const firstRowCardCount = 3;

// Two rows on desktop, enough to fill the first screen while recipes load.
const skeletonCardCount = 6;

function RecipeGrid({ children }: { children: React.ReactNode }) {
	return <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{children}</ul>;
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
