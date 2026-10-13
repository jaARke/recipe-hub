import {
	recipeAddedWithin,
	recipeSearchSorts,
	type RecipeAddedWithin,
	type RecipeSearchSort,
} from '@/application/ports/recipe-search';
import {
	recipeTotalTimeChoices,
	type RecipeSearchInput,
	type RecipeTotalTimeChoice,
} from '@/application/search/recipe-search-dtos';
import {
	hrefWithParams,
	parseOptionParam,
	parsePageParam,
	singleParam,
	type RouteSearchParams,
} from '@/components/recipe/recipe-list-params';
import { recipeListParamNames, recipeSearchPath } from '@/components/recipe/recipe-paths';
import { tagListSchema } from '@/domain/recipe/tag';
import { normalizeTagLabel } from '@/domain/recipe/tag-normalization';

// The search page's URL parameters, by the state they hold.
export const recipeSearchParamNames = {
	text: 'q',
	tags: 'tag',
	source: 'source',
	contributorId: 'contributor',
	maxTotalMinutes: 'time',
	addedWithin: 'added',
	sort: recipeListParamNames.sort,
	page: recipeListParamNames.page,
} as const;

export type RecipeSearchField = keyof typeof recipeSearchParamNames;

export type RecipeSearchState = {
	text?: string;
	tags: string[];
	source?: string;
	// A member's id; the filters show the name.
	contributorId?: string;
	maxTotalMinutes?: RecipeTotalTimeChoice;
	addedWithin?: RecipeAddedWithin;
	sort: RecipeSearchSort;
	page: number;
};

// One value of a URL parameter; a parameter appears once per tag.
export type RecipeSearchParam = {
	name: (typeof recipeSearchParamNames)[RecipeSearchField];
	value: string;
};

// Best match ranks by the text, so it is offered only with a query.
export function recipeSearchSortsFor(text: string | undefined): RecipeSearchSort[] {
	return text === undefined
		? recipeSearchSorts.filter((sort) => sort !== 'relevance')
		: [...recipeSearchSorts];
}

function defaultSearchSort(text: string | undefined): RecipeSearchSort {
	return text === undefined ? 'newest' : 'relevance';
}

// Trimmed, so a query of spaces is no query.
function parseTextParam(value: string | string[] | undefined): string | undefined | null {
	const param = singleParam(value);
	if (param === null || param === undefined) {
		return param;
	}

	const text = param.trim();
	return text === '' ? undefined : text;
}

// Lowercased, as the filters list ids, so a capital typed into the URL still chooses the member.
function parseIdParam(value: string | string[] | undefined): string | undefined | null {
	const param = parseTextParam(value);
	return typeof param === 'string' ? param.toLowerCase() : param;
}

// Blank tags are dropped and repeats keep their first spelling, as recipes store them.
function parseTagParams(value: string | string[] | undefined): string[] {
	const labels = value === undefined ? [] : [value].flat();
	return tagListSchema.parse(labels.filter((label) => normalizeTagLabel(label) !== ''));
}

export function parseRecipeSearchParams(params: RouteSearchParams): RecipeSearchState | null {
	const text = parseTextParam(params[recipeSearchParamNames.text]);
	const source = parseTextParam(params[recipeSearchParamNames.source]);
	const contributorId = parseIdParam(params[recipeSearchParamNames.contributorId]);
	const maxTotalMinutes = parseOptionParam(
		params[recipeSearchParamNames.maxTotalMinutes],
		recipeTotalTimeChoices
	);
	const addedWithin = parseOptionParam(
		params[recipeSearchParamNames.addedWithin],
		recipeAddedWithin
	);
	const page = parsePageParam(params[recipeSearchParamNames.page]);
	if (
		text === null ||
		source === null ||
		contributorId === null ||
		maxTotalMinutes === null ||
		addedWithin === null ||
		page === null
	) {
		return null;
	}

	const sort = parseOptionParam(params[recipeSearchParamNames.sort], recipeSearchSortsFor(text));
	if (sort === null) {
		return null;
	}

	return {
		text,
		tags: parseTagParams(params[recipeSearchParamNames.tags]),
		source,
		contributorId,
		maxTotalMinutes,
		addedWithin,
		sort: sort ?? defaultSearchSort(text),
		page,
	};
}

// Defaults are left out, so each search has one URL.
export function recipeSearchParams(state: RecipeSearchState): RecipeSearchParam[] {
	const params: RecipeSearchParam[] = [];
	const add = (field: RecipeSearchField, value: string) =>
		params.push({ name: recipeSearchParamNames[field], value });

	if (state.text !== undefined) {
		add('text', state.text);
	}
	for (const tag of state.tags) {
		add('tags', tag);
	}
	if (state.source !== undefined) {
		add('source', state.source);
	}
	if (state.contributorId !== undefined) {
		add('contributorId', state.contributorId);
	}
	if (state.maxTotalMinutes !== undefined) {
		add('maxTotalMinutes', String(state.maxTotalMinutes));
	}
	if (state.addedWithin !== undefined) {
		add('addedWithin', state.addedWithin);
	}
	if (state.sort !== defaultSearchSort(state.text)) {
		add('sort', state.sort);
	}
	if (state.page > 1) {
		add('page', String(state.page));
	}

	return params;
}

export function recipeSearchHref(state: RecipeSearchState): string {
	const params = new URLSearchParams();
	for (const { name, value } of recipeSearchParams(state)) {
		params.append(name, value);
	}

	return hrefWithParams(recipeSearchPath, params);
}

// What a form carries besides the fields it edits; any change starts again from the first page.
export function carriedSearchParams(
	state: RecipeSearchState,
	editedFields: readonly RecipeSearchField[]
): RecipeSearchParam[] {
	const droppedNames = new Set(
		[...editedFields, 'page' as const].map((field) => recipeSearchParamNames[field])
	);
	return recipeSearchParams(state).filter((param) => !droppedNames.has(param.name));
}

export function appliedFilterCount(state: RecipeSearchState): number {
	const choices = [state.source, state.contributorId, state.maxTotalMinutes, state.addedWithin];
	return state.tags.length + choices.filter((choice) => choice !== undefined).length;
}

// Keeps the query and the order.
export function withoutFilters(state: RecipeSearchState): RecipeSearchState {
	return { text: state.text, tags: [], sort: state.sort, page: 1 };
}

export function toRecipeSearchInput(state: RecipeSearchState, pageSize: number): RecipeSearchInput {
	return {
		text: state.text,
		tags: state.tags,
		source: state.source,
		contributorId: state.contributorId,
		maxTotalMinutes: state.maxTotalMinutes,
		addedWithin: state.addedWithin,
		sort: state.sort,
		limit: pageSize,
		offset: (state.page - 1) * pageSize,
	};
}
