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
	defaultListSort,
	parseOptionParam,
	parsePageParam,
	singleParam,
} from '@/components/recipe/recipe-list-params';
import {
	recipeListParamNames,
	recipeListPath,
	recipeSearchPath,
} from '@/components/recipe/recipe-paths';
import { chapters, type Chapter } from '@/domain/recipe/chapter';
import { diets, type Diet } from '@/domain/recipe/diet';
import { holidays, type Holiday } from '@/domain/recipe/holiday';
import { hrefWithParams, type RouteSearchParams } from '@/lib/url-query';

// Browse's and Search's URL parameters, by the state they hold.
export const recipeSearchParamNames = {
	text: 'q',
	chapter: 'chapter',
	holidays: 'holiday',
	diets: 'diet',
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
	chapter?: Chapter;
	holidays: Holiday[];
	diets: Diet[];
	source?: string;
	// A member's id; the filters show the name.
	contributorId?: string;
	maxTotalMinutes?: RecipeTotalTimeChoice;
	addedWithin?: RecipeAddedWithin;
	sort: RecipeSearchSort;
	page: number;
};

// The two lists a state is shown in: Browse lists the collection without words, and Search finds
// recipes by them, refined by the same filters.
export type RecipeSearchMode = 'browse' | 'search';

const recipeSearchModePaths: Record<RecipeSearchMode, string> = {
	browse: recipeListPath,
	search: recipeSearchPath,
};

// One value of a URL parameter; a parameter appears once per holiday or diet.
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
	return text === undefined ? defaultListSort : 'relevance';
}

export function recipeSearchMode(state: Pick<RecipeSearchState, 'text'>): RecipeSearchMode {
	return state.text === undefined ? 'browse' : 'search';
}

// Where the state's forms submit, so a form keeps a search in its mode.
export function recipeSearchModePath(state: Pick<RecipeSearchState, 'text'>): string {
	return recipeSearchModePaths[recipeSearchMode(state)];
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

// Each value once, in the vocabulary's order, or null when one is not in it. An empty value, which
// forms submit for blank fields, is absent.
function parseVocabularyParams<Value extends string>(
	value: string | string[] | undefined,
	vocabulary: readonly Value[]
): Value[] | null {
	const params = (value === undefined ? [] : [value].flat()).filter((param) => param !== '');
	return params.every((param) => vocabulary.some((option) => option === param))
		? vocabulary.filter((option) => params.includes(option))
		: null;
}

export function parseRecipeSearchParams(params: RouteSearchParams): RecipeSearchState | null {
	const text = parseTextParam(params[recipeSearchParamNames.text]);
	const chapter = parseOptionParam(params[recipeSearchParamNames.chapter], chapters);
	const chosenHolidays = parseVocabularyParams(params[recipeSearchParamNames.holidays], holidays);
	const chosenDiets = parseVocabularyParams(params[recipeSearchParamNames.diets], diets);
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
		chapter === null ||
		chosenHolidays === null ||
		chosenDiets === null ||
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
		chapter,
		holidays: chosenHolidays,
		diets: chosenDiets,
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
	if (state.chapter !== undefined) {
		add('chapter', state.chapter);
	}
	for (const holiday of state.holidays) {
		add('holidays', holiday);
	}
	for (const diet of state.diets) {
		add('diets', diet);
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

// Browse's URL without words and Search's with them; every link and redirect between the two is
// built here.
export function recipeSearchHref(state: RecipeSearchState): string {
	const params = new URLSearchParams();
	for (const { name, value } of recipeSearchParams(state)) {
		params.append(name, value);
	}

	return hrefWithParams(recipeSearchModePath(state), params);
}

// Where a request for Browse or Search belongs when it reached the other's path: a search without
// words is Browse, and Browse given words is Search, so each list has one URL. Undefined where it
// already is, or where the parameters are refused, which its page answers with a 404.
export function misplacedRecipeSearchHref(
	pathname: string,
	params: RouteSearchParams
): string | undefined {
	const state = parseRecipeSearchParams(params);
	return state === null || recipeSearchModePath(state) === pathname
		? undefined
		: recipeSearchHref(state);
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
	const choices = [
		state.chapter,
		state.source,
		state.contributorId,
		state.maxTotalMinutes,
		state.addedWithin,
	];
	return (
		state.holidays.length +
		state.diets.length +
		choices.filter((choice) => choice !== undefined).length
	);
}

// Keeps the query and the order.
export function withoutFilters(state: RecipeSearchState): RecipeSearchState {
	return { text: state.text, holidays: [], diets: [], sort: state.sort, page: 1 };
}

// Browse with the filters kept. Best match ranks by the words, so it leaves with them.
export function withoutText(state: RecipeSearchState): RecipeSearchState {
	const sort = state.sort === 'relevance' ? defaultSearchSort(undefined) : state.sort;
	return { ...state, text: undefined, sort, page: 1 };
}

// The words and the filters, which a new order or page leaves as they were.
export function recipeSearchFiltersKey(state: RecipeSearchState): string {
	const params = carriedSearchParams(state, ['sort']).map(({ name, value }) => [name, value]);
	return new URLSearchParams(params).toString();
}

export function toRecipeSearchInput(state: RecipeSearchState, pageSize: number): RecipeSearchInput {
	return {
		text: state.text,
		chapter: state.chapter,
		holidays: state.holidays,
		diets: state.diets,
		source: state.source,
		contributorId: state.contributorId,
		maxTotalMinutes: state.maxTotalMinutes,
		addedWithin: state.addedWithin,
		sort: state.sort,
		limit: pageSize,
		offset: (state.page - 1) * pageSize,
	};
}
