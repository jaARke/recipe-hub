'use client';

import { cn } from 'cn';
import { ChevronLeftIcon } from 'lucide-react';
import type * as React from 'react';
import { followsInThisTab } from '@/components/recipe/recipe-opened-from';
import {
	returnToRecipeList,
	useRecipeOpenedFrom,
} from '@/components/recipe/use-recipe-opened-from';

// GOV.UK's back link, above the recipe's title: it names the list the recipe was opened from in
// this tab and goes back in history to that page, so it returns as it was left. A recipe reached
// any other way shows none, since the header's Browse serves it, and a printout shows none.
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
	const { url, list } = openedFrom;

	// A click that opens another tab, or one after the list's entry is gone, loads the list's URL.
	function handleClick(event: React.MouseEvent<HTMLAnchorElement>) {
		if (followsInThisTab(event, event.currentTarget) && returnToRecipeList(recipePathname, url)) {
			event.preventDefault();
		}
	}

	return (
		<a
			href={url}
			onClick={handleClick}
			className={cn(
				'inline-flex items-center gap-1 text-sm underline underline-offset-4 print:hidden',
				className
			)}
		>
			<ChevronLeftIcon aria-hidden="true" className="size-4" />
			{list.backLabel}
		</a>
	);
}

export { RecipeBackLink };
