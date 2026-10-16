import type * as React from 'react';
import { favoritesPath, recipeListPath, recipeSearchPath } from '@/components/recipe/recipe-paths';

// Where each recipe was opened from in this tab: the full URL of the list's page, its query
// included, which the recipe's back link returns to and the header's current section follows. Pure,
// so the rule is tested without a browser.

export type RecipeList = {
	pathname: string;
	// The recipe's link back to the list.
	backLabel: string;
};

export type RecipeOpenedFrom = {
	// The list's page as the tab's history holds it, such as a search with its filters and page.
	url: string;
	list: RecipeList;
};

// The lists a recipe can be opened from.
const recipeLists: readonly RecipeList[] = [
	{ pathname: recipeListPath, backLabel: 'Back to recipes' },
	{ pathname: recipeSearchPath, backLabel: 'Back to search results' },
	{ pathname: favoritesPath, backLabel: 'Back to Favorites' },
];

const keyPrefix = 'opened-from';

function pathnameOf(url: string | null | undefined): string | undefined {
	return url != null && URL.canParse(url) ? new URL(url).pathname : undefined;
}

// The tab storage key holding where the recipe at the pathname was last opened from.
export function recipeOpenedFromKey(recipePathname: string): string {
	return `${keyPrefix}:${recipePathname}`;
}

// The list whose page the URL is, if any.
export function recipeListOf(url: string): RecipeList | undefined {
	const pathname = pathnameOf(url);
	return recipeLists.find((list) => list.pathname === pathname);
}

// A click the browser follows in this tab, as Next's Link reads one: the main button with no key
// held, on a link that opens no other tab and downloads nothing.
export function followsInThisTab(event: React.MouseEvent, link: HTMLAnchorElement): boolean {
	return (
		event.button === 0 &&
		!event.altKey &&
		!event.ctrlKey &&
		!event.metaKey &&
		!event.shiftKey &&
		(link.target === '' || link.target === '_self') &&
		!link.hasAttribute('download')
	);
}

// The index of the history entry the page at the pathname was reached from: the last one before the
// page's own entries, which share its pathname, since a jump to a heading on the page adds one.
// While a client navigation commits, the page renders before its entry is pushed, so the current
// entry is then already the one before it.
export function openerEntryIndex(
	entryUrls: readonly (string | null)[],
	currentIndex: number,
	pathname: string
): number | undefined {
	let index = currentIndex;
	while (index >= 0 && pathnameOf(entryUrls[index]) === pathname) {
		index -= 1;
	}
	return index >= 0 ? index : undefined;
}

// The list page a recipe was opened from: the one this tab recorded opening it from, when that
// exact URL is the entry the recipe's page was reached from, so going back returns to it as it was
// left. A recipe reached any other way, such as by a shared link, a typed address, or in a new tab,
// or one whose list entry was since replaced, was opened from no list.
export function recipeOpenedFromUrl(
	recorded: string | undefined,
	openerUrl: string | null | undefined
): string | undefined {
	return recorded !== undefined && recorded === openerUrl && recipeListOf(recorded) !== undefined
		? recorded
		: undefined;
}
