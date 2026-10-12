import { recipeSorts, type RecipeSort } from '@/application/ports/recipe-repository';
import { recipeListParamNames, recipeListPath } from '@/components/recipe/recipe-paths';

// A page's searchParams as Next.js passes them: a repeated parameter arrives as an array.
export type RouteSearchParams = Record<string, string | string[] | undefined>;

export type RecipeListState = {
	page: number;
	sort: RecipeSort;
};

export const defaultListSort: RecipeSort = 'newest';

// Null when the parameter repeats. An empty value, which forms submit for blank fields, is absent.
export function singleParam(value: string | string[] | undefined): string | undefined | null {
	if (Array.isArray(value)) {
		return null;
	}

	return value === '' ? undefined : value;
}

// An absent page is the first; any other page is a plain positive number.
export function parsePageParam(value: string | string[] | undefined): number | null {
	const page = singleParam(value);
	if (page === undefined) {
		return 1;
	}

	return page !== null && /^[1-9]\d*$/.test(page) ? Number(page) : null;
}

// Undefined when absent, or null when the value is not one of the options.
export function parseOptionParam<Option extends string | number>(
	value: string | string[] | undefined,
	options: readonly Option[]
): Option | undefined | null {
	const param = singleParam(value);
	if (param === null || param === undefined) {
		return param;
	}

	return options.find((option) => String(option) === param) ?? null;
}

export function hrefWithParams(path: string, params: URLSearchParams): string {
	const query = params.toString();
	return query === '' ? path : `${path}?${query}`;
}

export function parseRecipeListParams(params: RouteSearchParams): RecipeListState | null {
	const page = parsePageParam(params[recipeListParamNames.page]);
	const sort = parseOptionParam(params[recipeListParamNames.sort], recipeSorts);
	if (page === null || sort === null) {
		return null;
	}

	return { page, sort: sort ?? defaultListSort };
}

// The first page in the default order is the bare list, so its link matches the one in the header.
export function recipeListHref({ page, sort }: RecipeListState): string {
	const params = new URLSearchParams();
	if (sort !== defaultListSort) {
		params.set(recipeListParamNames.sort, sort);
	}
	if (page > 1) {
		params.set(recipeListParamNames.page, String(page));
	}

	return hrefWithParams(recipeListPath, params);
}
