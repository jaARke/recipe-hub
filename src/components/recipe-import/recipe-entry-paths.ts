import { contributePath, hrefWithParams } from '@/components/recipe/recipe-paths';

// The add page's tabs: the three ways to add a recipe, then the member's drafts.
export const recipeEntryTabs = ['manual', 'url', 'photo', 'drafts'] as const;

export type RecipeEntryTab = (typeof recipeEntryTabs)[number];

// The add page's URL parameters: the tab it opens on, and the saved draft its form opens.
export const recipeEntryParamNames = { tab: 'tab', draft: 'draft' } as const;

// One value names a tab or a draft; a missing or repeated one names none.
function singleValue(value: string | string[] | undefined): string | undefined {
	return typeof value === 'string' ? value : undefined;
}

// The tab the add page opens on: one its URL names, or the first.
export function parseRecipeEntryTab(value: string | string[] | undefined): RecipeEntryTab {
	const tab = singleValue(value);
	return recipeEntryTabs.find((known) => known === tab) ?? 'manual';
}

// The saved draft the add page's form opens, if its URL names one.
export function parseSavedDraftParam(value: string | string[] | undefined): string | undefined {
	return singleValue(value);
}

// Where deleting a draft leads: the list of drafts left.
export const draftsTabPath = hrefWithParams(
	contributePath,
	new URLSearchParams({ [recipeEntryParamNames.tab]: 'drafts' })
);

// Where a saved draft opens in the add page's form, which a reload opens again.
export function savedDraftPath(id: string): string {
	return hrefWithParams(contributePath, new URLSearchParams({ [recipeEntryParamNames.draft]: id }));
}
