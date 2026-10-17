import type { RecipeSort } from '@/application/ports/recipe-repository';
import { favoritesPath, recipeListParamNames } from '@/components/recipe/recipe-paths';
import { hrefWithParams } from '@/lib/url-query';

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

// Favorites list newest first in one order, so only the page reaches the URL, and the first is bare.
export function favoriteListHref(page: number): string {
	const params = new URLSearchParams();
	if (page > 1) {
		params.set(recipeListParamNames.page, String(page));
	}

	return hrefWithParams(favoritesPath, params);
}
