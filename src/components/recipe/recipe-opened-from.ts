import type * as React from 'react';
import { z } from 'zod';
import { favoritesPath, recipeListPath, recipeSearchPath } from '@/components/recipe/recipe-paths';

// Where each recipe was opened from in this tab: the full URL of the list's page, its query
// included, which the recipe's back link returns to and the header's current section follows, and
// the back link's label, which the list names on the server, since only it knows its view. Pure, so
// the rule is tested without a browser.

// What a list records in the tab's storage as a recipe is opened from it.
export type RecipeOpenedFromRecord = {
	// The list's page as the tab's history holds it, such as a search with its filters and page.
	url: string;
	// The recipe's link back to the list.
	backLabel: string;
};

export type RecipeOpenedFrom = RecipeOpenedFromRecord & {
	// The list's pathname, by which the header marks its section.
	listPathname: string;
};

// The lists a recipe can be opened from, by pathname.
const recipeListPathnames: readonly string[] = [recipeListPath, recipeSearchPath, favoritesPath];

const keyPrefix = 'opened-from';

const recordSchema = z.object({ url: z.string(), backLabel: z.string().min(1) });

function pathnameOf(url: string | null | undefined): string | undefined {
	return url != null && URL.canParse(url) ? new URL(url).pathname : undefined;
}

// The tab storage key holding where the recipe at the pathname was last opened from.
export function recipeOpenedFromKey(recipePathname: string): string {
	return `${keyPrefix}:${recipePathname}`;
}

// The value a list keeps under the recipe's key.
export function recipeOpenedFromValue(record: RecipeOpenedFromRecord): string {
	return JSON.stringify(record);
}

// The list a kept value names, or undefined where there is none, where it can't be read (as the bare
// URL an earlier version kept), or where its page is no list's.
export function readRecipeOpenedFrom(value: string | undefined): RecipeOpenedFrom | undefined {
	if (value === undefined) {
		return undefined;
	}
	let data: unknown;
	try {
		data = JSON.parse(value);
	} catch {
		return undefined;
	}
	const result = recordSchema.safeParse(data);
	if (!result.success) {
		return undefined;
	}
	const listPathname = pathnameOf(result.data.url);
	return listPathname !== undefined && recipeListPathnames.includes(listPathname)
		? { ...result.data, listPathname }
		: undefined;
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

// The list a recipe was opened from: the one this tab recorded opening it from, when that exact URL
// is the entry the recipe's page was reached from, so going back returns to it as it was left. A
// recipe reached any other way, such as by a shared link, a typed address, or in a new tab, or one
// whose list entry was since replaced, was opened from no list.
export function recipeOpenedFrom(
	value: string | undefined,
	openerUrl: string | null | undefined
): RecipeOpenedFrom | undefined {
	const openedFrom = readRecipeOpenedFrom(value);
	return openedFrom !== undefined && openedFrom.url === openerUrl ? openedFrom : undefined;
}
