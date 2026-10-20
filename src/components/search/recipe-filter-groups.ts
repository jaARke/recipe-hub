import {
	recipeTotalTimeChoices,
	type RecipeContributorCount,
	type RecipeFacetCount,
	type RecipeSearchFacets,
	type RecipeSearchSort,
	type RecipeTotalTimeChoice,
} from '@/application/ports/recipe-search';
import {
	sameSource,
	withRecipeFilterCounts,
	type RecipeFilterGroup,
	type RecipeFilterGroups,
	type RecipeFilterOption,
} from '@/components/search/recipe-filter-counts';
import {
	carriedSearchParams,
	defaultSearchSort,
	recipeFilterFields,
	recipeSearchHref,
	recipeSearchParamNames,
	recipeSearchSortsFor,
	type RecipeFilterSearchField,
	type RecipeSearchField,
	type RecipeSearchParam,
	type RecipeSearchState,
} from '@/components/search/search-params';
import { dietLabels, diets } from '@/domain/recipe/diet';
import { holidayLabels, holidays } from '@/domain/recipe/holiday';

const sortLabels: Record<RecipeSearchSort, string> = {
	relevance: 'Best match',
	newest: 'Newest first',
	title: 'A to Z',
};

const totalTimeLabels: Record<RecipeTotalTimeChoice, string> = {
	15: '15 minutes or less',
	30: '30 minutes or less',
	60: '1 hour or less',
	120: '2 hours or less',
};

// The "any" choice's value, which no time, source, or member takes, and which reads as absent even
// if a form submits it.
const anyValue = '';

// "Recipe from" shows its first six options, Anyone among them, and folds the rest, unless only one
// would fold, which takes no more room than the fold's own summary.
const shownSourceOptions = 6;

type SourceChoice = {
	// The facet's sources, then a chosen one it lacks, at zero, so it can be cleared.
	sources: RecipeFacetCount[];
	// As recipes spell it, or as the URL does where no recipe has it.
	chosen?: string;
};

// Sources compare ignoring case, so the chosen one takes the spelling recipes use.
function sourceChoice(
	state: Pick<RecipeSearchState, 'source'>,
	facetSources: readonly RecipeFacetCount[]
): SourceChoice {
	const chosen = state.source;
	if (chosen === undefined) {
		return { sources: [...facetSources] };
	}

	const match = facetSources.find((source) => sameSource(source.label, chosen));
	return match === undefined
		? { sources: [...facetSources, { label: chosen, count: 0 }], chosen }
		: { sources: [...facetSources], chosen: match.label };
}

// A contributor's value is an id and its label a name, which only the facet knows. Unlike a source, a
// chosen member missing from the facet cannot be added here, so the facet always lists it, and search
// refuses an id it lacks.
function chosenContributor(
	state: Pick<RecipeSearchState, 'contributorId'>,
	facetContributors: readonly RecipeContributorCount[]
): RecipeContributorCount | undefined {
	return facetContributors.find((contributor) => contributor.memberId === state.contributorId);
}

// In view, and enabled until counted.
function option(label: string, value: string): RecipeFilterOption {
	return { label, value, folded: false, disabled: false };
}

function sourceGroup(
	state: RecipeSearchState,
	facetSources: readonly RecipeFacetCount[]
): RecipeFilterGroup {
	const { sources, chosen } = sourceChoice(state, facetSources);
	const options = [
		option('Anyone', anyValue),
		...sources.map((source) => option(source.label, source.label)),
	];
	const folds = options.length > shownSourceOptions + 1;
	return {
		legend: 'Recipe from',
		field: recipeSearchParamNames.source,
		selection: 'single',
		options: options.map((shown, index) => ({
			...shown,
			folded: folds && index >= shownSourceOptions,
		})),
		chosen: chosen ?? anyValue,
		defaultValue: anyValue,
	};
}

// Filter and sort for a view: its orders, then each filter with what choosing each option would show.
// The chapter is the view, which the chapter list chooses.
export function recipeFilterGroups(
	state: RecipeSearchState,
	facets: RecipeSearchFacets
): RecipeFilterGroups {
	// Keyed by field, so Filter and sort lists every one, in the order the URL writes them.
	const groups: Record<RecipeFilterSearchField, RecipeFilterGroup> = {
		holidays: {
			legend: 'Holidays',
			field: recipeSearchParamNames.holidays,
			selection: 'multiple',
			options: holidays.map((holiday) => option(holidayLabels[holiday], holiday)),
			chosen: state.holidays,
		},
		diets: {
			legend: 'Diet',
			field: recipeSearchParamNames.diets,
			selection: 'multiple',
			options: diets.map((diet) => option(dietLabels[diet], diet)),
			chosen: state.diets,
		},
		maxTotalMinutes: {
			legend: 'Total time',
			field: recipeSearchParamNames.maxTotalMinutes,
			selection: 'single',
			options: [
				option('Any length', anyValue),
				...recipeTotalTimeChoices.map((minutes) =>
					option(totalTimeLabels[minutes], String(minutes))
				),
			],
			chosen: state.maxTotalMinutes === undefined ? anyValue : String(state.maxTotalMinutes),
			defaultValue: anyValue,
		},
		source: sourceGroup(state, facets.sources),
		contributorId: {
			legend: 'Added by',
			field: recipeSearchParamNames.contributorId,
			selection: 'single',
			options: [
				option('Any member', anyValue),
				...facets.contributors.map((contributor) =>
					option(contributor.displayName, contributor.memberId)
				),
			],
			chosen: chosenContributor(state, facets.contributors)?.memberId ?? anyValue,
			defaultValue: anyValue,
		},
	};
	const filters = recipeFilterFields.map((field) => groups[field]);

	return {
		sort: {
			legend: 'Sort by',
			field: recipeSearchParamNames.sort,
			selection: 'single',
			options: recipeSearchSortsFor(state.text).map((sort) => option(sortLabels[sort], sort)),
			chosen: state.sort,
			defaultValue: defaultSearchSort(state),
		},
		filters: withRecipeFilterCounts(filters, facets),
	};
}

// What Filter and sort chooses: every filter but the chapter, and the order.
const recipeFilterEditedFields: readonly RecipeSearchField[] = [
	'holidays',
	'diets',
	'source',
	'contributorId',
	'maxTotalMinutes',
	'sort',
];

// What Filter and sort's form carries besides its choices: the words and the chapter, which name the
// view.
export function recipeFilterCarriedParams(state: RecipeSearchState): RecipeSearchParam[] {
	return carriedSearchParams(state, recipeFilterEditedFields);
}

export type AppliedRecipeFilter = {
	// Unique among the view's filters.
	key: string;
	// As its option reads, with "From" before a source and "Added by" before a member.
	label: string;
	// The view without it, from the first page.
	href: string;
};

// The filters a view applies, as its chips name them, in Filter and sort's order. The words and the
// chapter are the view, not filters.
export function appliedRecipeFilters(
	state: RecipeSearchState,
	facets: RecipeSearchFacets
): AppliedRecipeFilter[] {
	const without = (change: Partial<RecipeSearchState>) =>
		recipeSearchHref({ ...state, ...change, page: 1 });
	const applied: AppliedRecipeFilter[] = [];

	for (const holiday of state.holidays) {
		applied.push({
			key: `holiday-${holiday}`,
			label: holidayLabels[holiday],
			href: without({ holidays: state.holidays.filter((other) => other !== holiday) }),
		});
	}
	for (const diet of state.diets) {
		applied.push({
			key: `diet-${diet}`,
			label: dietLabels[diet],
			href: without({ diets: state.diets.filter((other) => other !== diet) }),
		});
	}
	if (state.maxTotalMinutes !== undefined) {
		applied.push({
			key: 'time',
			label: totalTimeLabels[state.maxTotalMinutes],
			href: without({ maxTotalMinutes: undefined }),
		});
	}
	const source = sourceChoice(state, facets.sources).chosen;
	if (source !== undefined) {
		applied.push({ key: 'source', label: `From ${source}`, href: without({ source: undefined }) });
	}
	const contributor = chosenContributor(state, facets.contributors);
	if (contributor !== undefined) {
		applied.push({
			key: 'contributor',
			label: `Added by ${contributor.displayName}`,
			href: without({ contributorId: undefined }),
		});
	}
	return applied;
}
