import { contributePath } from '@/components/recipe/recipe-paths';
import type { Provenance } from '@/domain/recipe/provenance';
import { hrefWithParams, type RouteSearchParams } from '@/lib/url-query';

type EntryMode = Provenance['entryMode'];

// The page each way to start a recipe opens from the start page: an empty form, or an import.
export const recipeEntryPaths = {
	manual: `${contributePath}/new`,
	url: `${contributePath}/link`,
	photo: `${contributePath}/photos`,
} as const satisfies Record<EntryMode, string>;

// The start page's parameter naming the saved draft just left, which its notice says is kept.
export const keptDraftParamName = 'kept';

// One value names a draft or a tab; a missing or repeated one names none.
function singleValue(value: string | string[] | undefined): string | undefined {
	return typeof value === 'string' ? value : undefined;
}

// A saved draft's own page, which a reload opens again.
export function savedDraftPath(id: string): string {
	return `${contributePath}/drafts/${id}`;
}

// The start page as a draft's back link leaves for it, saying the draft is kept.
export function keptDraftPath(id: string): string {
	return hrefWithParams(contributePath, new URLSearchParams({ [keptDraftParamName]: id }));
}

// The saved draft the start page's URL says was just left, if it names one.
export function parseKeptDraftParam(value: string | string[] | undefined): string | undefined {
	return singleValue(value);
}

// The start page's addresses from when it held each way in as a tab, and opened a saved draft in its
// own form, which links and bookmarks may still hold.
const movedParamNames = { tab: 'tab', draft: 'draft' } as const;

const movedTabPaths = {
	...recipeEntryPaths,
	drafts: contributePath,
} as const;

const movedTabs = Object.keys(movedTabPaths) as (keyof typeof movedTabPaths)[];

// Where one of those addresses now leads, or undefined for an address that is the start page's own. A
// draft takes precedence, as it opened in its tab; a tab it doesn't know leads to the start page.
export function movedRecipeEntryHref(params: RouteSearchParams): string | undefined {
	const draftId = singleValue(params[movedParamNames.draft]);
	if (draftId !== undefined) {
		return savedDraftPath(draftId);
	}
	if (params[movedParamNames.draft] === undefined && params[movedParamNames.tab] === undefined) {
		return undefined;
	}
	const tab = singleValue(params[movedParamNames.tab]);
	const known = movedTabs.find((moved) => moved === tab);
	return known === undefined ? contributePath : movedTabPaths[known];
}
