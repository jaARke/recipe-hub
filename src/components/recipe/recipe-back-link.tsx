'use client';

import type * as React from 'react';
import { BackLink } from '@/components/layout/back-link';
import { followsInThisTab } from '@/components/recipe/recipe-opened-from';
import {
	returnToRecipeList,
	useRecipeOpenedFrom,
} from '@/components/recipe/use-recipe-opened-from';

// The back link above a recipe's title: it names the list the recipe was opened from in this tab, in
// the words that list recorded, and goes back in history to that page, so it returns as it was left.
// A recipe reached any other way shows none, since the header's Browse serves it.
function RecipeBackLink({
	recipePathname,
	className,
}: {
	recipePathname: string;
	className?: string;
}) {
	const openedFrom = useRecipeOpenedFrom(recipePathname);
	if (openedFrom === undefined) {
		return null;
	}
	const { url, backLabel } = openedFrom;

	// A click that opens another tab, or one after the list's entry is gone, loads the list's URL.
	function handleClick(event: React.MouseEvent<HTMLAnchorElement>) {
		if (followsInThisTab(event, event.currentTarget) && returnToRecipeList(recipePathname, url)) {
			event.preventDefault();
		}
	}

	return (
		// Not prefetched: the click goes back in history, so loading the list's page ahead is wasted.
		<BackLink href={url} prefetch={false} onClick={handleClick} className={className}>
			{backLabel}
		</BackLink>
	);
}

export { RecipeBackLink };
