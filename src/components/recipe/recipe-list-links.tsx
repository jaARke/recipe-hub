'use client';

import * as React from 'react';
import { followsInThisTab } from '@/components/recipe/recipe-opened-from';
import { recipePagesPath } from '@/components/recipe/recipe-paths';
import { recordRecipeOpened } from '@/components/recipe/use-recipe-opened-from';

// Holds a list's links to recipes, such as Browse's cards or search's results, and records the page,
// with the label the list gives the recipe's link back to it, as where a recipe was opened from as
// its link is followed in this tab.
function RecipeListLinks({
	backLabel,
	children,
}: {
	backLabel: string;
	children: React.ReactNode;
}) {
	function handleClick(event: React.MouseEvent<HTMLDivElement>) {
		const link = event.target instanceof Element ? event.target.closest('a') : null;
		if (
			link !== null &&
			link.pathname.startsWith(`${recipePagesPath}/`) &&
			followsInThisTab(event, link)
		) {
			recordRecipeOpened(link.pathname, backLabel);
		}
	}

	// Leaves the layout to the list inside it.
	return (
		<div className="contents" onClick={handleClick}>
			{children}
		</div>
	);
}

export { RecipeListLinks };
