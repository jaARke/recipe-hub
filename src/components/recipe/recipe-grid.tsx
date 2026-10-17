import * as React from 'react';
import { RecipeCardSkeleton } from '@/components/recipe/recipe-card';
import { RecipeListLinks } from '@/components/recipe/recipe-list-links';

// Two rows on desktop, enough to fill the first screen: the skeletons while recipes load, and the
// cards whose photos load eagerly, since a second-row photo is the largest paint where the first
// row's cards have none.
const firstScreenCardCount = 6;

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
				{Array.from({ length: firstScreenCardCount }, (_, index) => (
					<li key={index}>
						<RecipeCardSkeleton />
					</li>
				))}
			</RecipeGrid>
		</div>
	);
}

export { firstScreenCardCount, RecipeGrid, RecipeGridSkeleton };
