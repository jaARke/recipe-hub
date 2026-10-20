import {
	recipeSearchSorts,
	recipeTotalTimeChoices,
	type RecipeSearchSort,
	type RecipeTotalTimeChoice,
} from '@/application/ports/recipe-search';
import type { RecipeCountsInput, RecipeSearchInput } from '@/application/search/recipe-search-dtos';
import {
	defaultListSort,
	parseOptionParam,
	parsePageParam,
	singleParam,
} from '@/components/recipe/recipe-list-params';
import {
	allRecipesTitle,
	recipeListParamNames,
	recipeListPath,
} from '@/components/recipe/recipe-paths';
import { chapterLabels, chapters, type Chapter } from '@/domain/recipe/chapter';
import { diets, type Diet } from '@/domain/recipe/diet';
import { holidays, type Holiday } from '@/domain/recipe/holiday';
import { hrefWithParams, type RouteSearchParams } from '@/lib/url-query';

// The URL's parameters, by the state they hold, in the order every URL writes them: the words, the
// chapter, the filters in Filter and sort's order, the order, and the page.
export const recipeSearchParamNames = {
	text: 'q',
	chapter: 'chapter',
	holidays: 'holiday',
	diets: 'diet',
	maxTotalMinutes: 'time',
	source: 'source',
	contributorId: 'contributor',
	sort: recipeListParamNames.sort,
	page: recipeListParamNames.page,
} as const;

export type RecipeSearchField = keyof typeof recipeSearchParamNames;

// The fields Filter and sort offers: every one but the words, the chapter, the order, and the page.
export type RecipeFilterSearchField = Exclude<
	RecipeSearchField,
	'text' | 'chapter' | 'sort' | 'page'
>;

const recipeSearchFields = Object.keys(recipeSearchParamNames) as RecipeSearchField[];

const viewFields: readonly RecipeSearchField[] = ['text', 'chapter', 'sort', 'page'];

// Filter and sort's fields in its order, which the URL follows.
export const recipeFilterFields = recipeSearchFields.filter(
	(field): field is RecipeFilterSearchField => !viewFields.includes(field)
);

export type RecipeSearchState = {
	text?: string;
	chapter?: Chapter;
	holidays: Holiday[];
	diets: Diet[];
	source?: string;
	// A member's id; the filters show the name.
	contributorId?: string;
	maxTotalMinutes?: RecipeTotalTimeChoice;
	// The order shown: the view's default unless the URL names another.
	sort: RecipeSearchSort;
	page: number;
};

// What a state shows, apart from its filters, order, and page: its words and its chapter, which name
// it and set its default order.
type RecipeSearchView = Pick<RecipeSearchState, 'text' | 'chapter'>;

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

// Best match with words, a chapter A to Z as a cookbook reads, and every recipe newest first.
export function defaultSearchSort(view: RecipeSearchView): RecipeSearchSort {
	if (view.text !== undefined) {
		return 'relevance';
	}

	return view.chapter === undefined ? defaultListSort : 'title';
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

// Null when a value is refused: one parameter repeated, or a value it does not offer.
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
	const page = parsePageParam(params[recipeSearchParamNames.page]);
	if (
		text === null ||
		chapter === null ||
		chosenHolidays === null ||
		chosenDiets === null ||
		source === null ||
		contributorId === null ||
		maxTotalMinutes === null ||
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
		sort: sort ?? defaultSearchSort({ text, chapter }),
		page,
	};
}

// A field's values in the URL, none where the state holds its default.
const fieldValues: Record<RecipeSearchField, (state: RecipeSearchState) => readonly string[]> = {
	text: (state) => (state.text === undefined ? [] : [state.text]),
	chapter: (state) => (state.chapter === undefined ? [] : [state.chapter]),
	holidays: (state) => state.holidays,
	diets: (state) => state.diets,
	maxTotalMinutes: (state) =>
		state.maxTotalMinutes === undefined ? [] : [String(state.maxTotalMinutes)],
	source: (state) => (state.source === undefined ? [] : [state.source]),
	contributorId: (state) => (state.contributorId === undefined ? [] : [state.contributorId]),
	sort: (state) => (state.sort === defaultSearchSort(state) ? [] : [state.sort]),
	page: (state) => (state.page > 1 ? [String(state.page)] : []),
};

// Defaults are left out, so each view has one URL; the default order is the view's.
export function recipeSearchParams(state: RecipeSearchState): RecipeSearchParam[] {
	return recipeSearchFields.flatMap((field) =>
		fieldValues[field](state).map((value) => ({ name: recipeSearchParamNames[field], value }))
	);
}

// The Recipes page's URL for the state; every link to a view of it is built here.
export function recipeSearchHref(state: RecipeSearchState): string {
	const params = new URLSearchParams();
	for (const { name, value } of recipeSearchParams(state)) {
		params.append(name, value);
	}

	return hrefWithParams(recipeListPath, params);
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

// The filters chosen, each holiday and diet counting once. The chapter is the view, not a filter.
export function appliedFilterCount(state: RecipeSearchState): number {
	const choices = [state.source, state.contributorId, state.maxTotalMinutes];
	return (
		state.holidays.length +
		state.diets.length +
		choices.filter((choice) => choice !== undefined).length
	);
}

// The state a change of words or chapter leads to, from the first page. An order chosen apart from
// the view's default stays, and leaves the URL where it is the new view's default; a default order
// gives way to the new view's own.
function toView(state: RecipeSearchState, view: RecipeSearchView): RecipeSearchState {
	const sort = state.sort === defaultSearchSort(state) ? defaultSearchSort(view) : state.sort;
	return { ...state, text: view.text, chapter: view.chapter, sort, page: 1 };
}

// A row of the chapter list, which keeps the words and the filters.
export function withChapter(state: RecipeSearchState, chapter: Chapter): RecipeSearchState {
	return toView(state, { text: state.text, chapter });
}

// Back to All Recipes and the chapter list's All Recipes, which keep the words and the filters.
export function withoutChapter(state: RecipeSearchState): RecipeSearchState {
	return toView(state, { text: state.text, chapter: undefined });
}

// The search box's ×, which keeps the chapter and the filters. Best match ranks by the words, so it
// leaves with them.
export function withoutText(state: RecipeSearchState): RecipeSearchState {
	return toView(state, { text: undefined, chapter: state.chapter });
}

// Clear all, which keeps the words, the chapter, and the order.
export function withoutFilters(state: RecipeSearchState): RecipeSearchState {
	return {
		text: state.text,
		chapter: state.chapter,
		holidays: [],
		diets: [],
		sort: state.sort,
		page: 1,
	};
}

// The words, the chapter, and the filters, which a new order or page leaves as they were.
export function recipeSearchFiltersKey(state: RecipeSearchState): string {
	const params = carriedSearchParams(state, ['sort']).map(({ name, value }) => [name, value]);
	return new URLSearchParams(params).toString();
}

// A chapter, or every recipe, as a link from outside the list opens it: no words or filters, in its
// default order, from the first page.
export function recipesView(chapter?: Chapter): RecipeSearchState {
	return { chapter, holidays: [], diets: [], sort: defaultSearchSort({ chapter }), page: 1 };
}

type RecipesViewName = {
	// In title case, as every h1 is.
	heading: string;
	// The document's title.
	title: string;
	// What a recipe opened from the view says to return to it.
	backLabel: string;
};

// A view is named by its chapter, or as All Recipes, whatever filters it holds; one with words is a
// search's results, and its title says for what.
export function recipesViewName(view: RecipeSearchView): RecipesViewName {
	const heading = view.chapter === undefined ? allRecipesTitle : chapterLabels[view.chapter];
	if (view.text === undefined) {
		return { heading, title: heading, backLabel: `Back to ${heading}` };
	}

	const within = view.chapter === undefined ? '' : ` in ${heading}`;
	return {
		heading,
		title: `Search results for “${view.text}”${within}`,
		backLabel: 'Back to search results',
	};
}

type RecipesCanonical = {
	href: string;
	// Whether search engines list the view; its links are followed either way.
	indexed: boolean;
};

// Every recipe and each chapter are listed under their normalized URL, with their order and page, so
// /?page=1 points at /. Words and filters multiply URLs, so a view with either stays out and names
// its chapter, or every recipe, as a link opens it.
export function recipesCanonical(state: RecipeSearchState): RecipesCanonical {
	return state.text === undefined && appliedFilterCount(state) === 0
		? { href: recipeSearchHref(state), indexed: true }
		: { href: recipeSearchHref(recipesView(state.chapter)), indexed: false };
}

// The words and filters, which set the counts; the order and page leave them as they are.
export function toRecipeCountsInput(state: RecipeSearchState): RecipeCountsInput {
	return {
		text: state.text,
		chapter: state.chapter,
		holidays: state.holidays,
		diets: state.diets,
		source: state.source,
		contributorId: state.contributorId,
		maxTotalMinutes: state.maxTotalMinutes,
	};
}

export function toRecipeSearchInput(state: RecipeSearchState, pageSize: number): RecipeSearchInput {
	return {
		...toRecipeCountsInput(state),
		sort: state.sort,
		limit: pageSize,
		offset: (state.page - 1) * pageSize,
	};
}
