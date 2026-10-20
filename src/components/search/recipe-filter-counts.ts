// Client components take Filter and sort's groups as props and recount them from fetched counts, so
// this module imports only types from server-only modules.
import type { RecipeFacetCount } from '@/application/ports/recipe-search';
import type { RecipeSearchField, recipeSearchParamNames } from '@/components/search/search-params';

// The parameters of the filters Filter and sort offers: every one but the words, the chapter, which
// the chapter list chooses, the order, and the page.
export type RecipeFilterField = (typeof recipeSearchParamNames)[Exclude<
	RecipeSearchField,
	'text' | 'chapter' | 'sort' | 'page'
>];

type RecipeSortField = (typeof recipeSearchParamNames)['sort'];

export type RecipeFilterOption = {
	label: string;
	value: string;
	// What choosing it would show. An "any" choice and an order have none.
	count?: number;
	// Past the group's first few, by position, so counts never move it in or out of the fold.
	folded: boolean;
	// Nothing to show, and not chosen.
	disabled: boolean;
};

type RecipeChoiceGroupBase<Field extends string> = {
	legend: string;
	// The URL parameter it submits.
	field: Field;
	options: RecipeFilterOption[];
};

// Radios, one always chosen.
export type RecipeSingleChoiceGroup<Field extends string> = RecipeChoiceGroupBase<Field> & {
	selection: 'single';
	chosen: string;
	// The "any" choice, or the view's own order. The URL leaves it out, so chosen it submits no name.
	defaultValue: string;
};

// Checkboxes, any number chosen.
export type RecipeMultipleChoiceGroup<Field extends string> = RecipeChoiceGroupBase<Field> & {
	selection: 'multiple';
	chosen: string[];
};

export type RecipeFilterGroup =
	RecipeSingleChoiceGroup<RecipeFilterField> | RecipeMultipleChoiceGroup<RecipeFilterField>;

export type RecipeSortGroup = RecipeSingleChoiceGroup<RecipeSortField>;

export type RecipeFilterGroups = {
	// Sort by, which comes first and which clearing the filters keeps.
	sort: RecipeSortGroup;
	filters: RecipeFilterGroup[];
};

// The counts Filter and sort reads, keyed as its options' values are: the page's facets, or the counts
// route's answer as the browser checked it.
export type RecipeFilterCounts = {
	holidays: Readonly<Record<string, number>>;
	diets: Readonly<Record<string, number>>;
	totalTimes: Readonly<Record<string, number>>;
	sources: readonly RecipeFacetCount[];
	contributors: readonly { memberId: string; count: number }[];
};

// Sources compare ignoring case, as search finds them.
export function sameSource(source: string, other: string): boolean {
	return source.toLowerCase() === other.toLowerCase();
}

// A holiday's or diet's count by its slug, or a time's by its minutes, as an option's value names it.
function memberCount(counts: Readonly<Record<string, number>>, value: string): number {
	return Object.entries(counts).find(([member]) => member === value)?.[1] ?? 0;
}

// An option's count among the facets, by its group's parameter. A source or member the facets lack
// has none to show.
const optionCounts: Record<
	RecipeFilterField,
	(counts: RecipeFilterCounts, value: string) => number
> = {
	holiday: (counts, value) => memberCount(counts.holidays, value),
	diet: (counts, value) => memberCount(counts.diets, value),
	time: (counts, value) => memberCount(counts.totalTimes, value),
	source: (counts, value) =>
		counts.sources.find((source) => sameSource(source.label, value))?.count ?? 0,
	contributor: (counts, value) =>
		counts.contributors.find((contributor) => contributor.memberId === value)?.count ?? 0,
};

function isAnyChoice(group: RecipeFilterGroup, value: string): boolean {
	return group.selection === 'single' && value === group.defaultValue;
}

function isChosen(group: RecipeFilterGroup, value: string): boolean {
	return group.selection === 'single' ? group.chosen === value : group.chosen.includes(value);
}

// The groups as the counts for their choices show them: each option with what choosing it would
// show, disabled at zero unless chosen. Options keep their order and their folds.
export function withRecipeFilterCounts(
	groups: readonly RecipeFilterGroup[],
	counts: RecipeFilterCounts
): RecipeFilterGroup[] {
	return groups.map((group) => ({
		...group,
		options: group.options.map((option) => {
			if (isAnyChoice(group, option.value)) {
				return option;
			}

			const count = optionCounts[group.field](counts, option.value);
			return { ...option, count, disabled: count === 0 && !isChosen(group, option.value) };
		}),
	}));
}
