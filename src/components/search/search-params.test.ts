import { describe, expect, it } from 'vitest';
import type { RouteSearchParams } from '@/components/recipe/recipe-list-params';
import {
	appliedFilterCount,
	carriedSearchParams,
	parseRecipeSearchParams,
	recipeSearchHref,
	recipeSearchSortsFor,
	toRecipeSearchInput,
	withoutFilters,
	type RecipeSearchState,
} from '@/components/search/search-params';

// A query string as Next.js passes it to a page: a repeated parameter becomes an array.
function routeParams(query: string): RouteSearchParams {
	const params: RouteSearchParams = {};
	for (const [name, value] of new URLSearchParams(query)) {
		const existing = params[name];
		params[name] = existing === undefined ? value : [existing, value].flat();
	}
	return params;
}

function parse(query: string): RecipeSearchState | null {
	return parseRecipeSearchParams(routeParams(query));
}

const adaId = '0199c7a4-2c3e-7b1a-9f00-2a7c1e4b5d6e';

const fullState: RecipeSearchState = {
	text: 'brown butter',
	tags: ['Baking', 'Make ahead'],
	source: 'Aunt June',
	contributorId: adaId,
	maxTotalMinutes: 60,
	addedWithin: 'month',
	sort: 'title',
	page: 2,
};

describe('parseRecipeSearchParams', () => {
	it('lists every recipe newest first when nothing is asked for', () => {
		expect(parse('')).toEqual({ tags: [], sort: 'newest', page: 1 });
	});

	it('ranks by relevance when there is a query', () => {
		expect(parse('q=soup')).toEqual({ text: 'soup', tags: [], sort: 'relevance', page: 1 });
	});

	it('reads every parameter', () => {
		expect(
			parse(
				`q=brown+butter&tag=Baking&tag=Make+ahead&source=Aunt+June&contributor=${adaId}&time=60&added=month&sort=title&page=2`
			)
		).toEqual(fullState);
	});

	it('treats the empty values a form submits as absent', () => {
		expect(parse('q=&tag=&source=&contributor=&time=&added=&sort=&page=')).toEqual({
			tags: [],
			sort: 'newest',
			page: 1,
		});
	});

	it('trims the query and the source, so spaces alone are absent', () => {
		expect(parse('q=++soup++&source=+Aunt+June+')).toMatchObject({
			text: 'soup',
			source: 'Aunt June',
		});
		expect(parse('q=+++')).toEqual({ tags: [], sort: 'newest', page: 1 });
	});

	it('lowercases the contributor id, as the filters list it', () => {
		expect(parse(`contributor=+${adaId.toUpperCase()}+`)?.contributorId).toBe(adaId);
	});

	it('keeps the first spelling of a repeated tag and drops blank ones', () => {
		expect(parse('tag=Make+ahead&tag=make++AHEAD&tag=+&tag=Soup')?.tags).toEqual([
			'Make ahead',
			'Soup',
		]);
	});

	it('ignores parameters it does not know', () => {
		expect(parse('q=soup&ref=share')).toEqual({
			text: 'soup',
			tags: [],
			sort: 'relevance',
			page: 1,
		});
	});

	it('keeps an order that matches the default', () => {
		expect(parse('q=soup&sort=relevance')?.sort).toBe('relevance');
		expect(parse('sort=newest')?.sort).toBe('newest');
	});

	it.each([
		['an unknown total time', 'time=45'],
		['an unknown date range', 'added=decade'],
		['an unknown order', 'sort=oldest'],
		['best match without a query', 'sort=relevance'],
		['an invalid page', 'page=0'],
		['a repeated query', 'q=soup&q=stew'],
		['a repeated source', 'source=Aunt+June&source=Grandpa+Lou'],
		['a repeated contributor', `contributor=${adaId}&contributor=${adaId}`],
	])('refuses %s', (_case, query) => {
		expect(parse(query)).toBeNull();
	});
});

describe('recipeSearchHref', () => {
	it('links the bare search page when nothing is asked for', () => {
		expect(recipeSearchHref({ tags: [], sort: 'newest', page: 1 })).toBe('/search');
	});

	it('lists parameters in a fixed order and leaves out the default order and first page', () => {
		expect(recipeSearchHref({ ...fullState, sort: 'relevance', page: 1 })).toBe(
			`/search?q=brown+butter&tag=Baking&tag=Make+ahead&source=Aunt+June&contributor=${adaId}&time=60&added=month`
		);
	});

	it('keeps an order that differs from the default', () => {
		expect(recipeSearchHref({ text: 'soup', tags: [], sort: 'newest', page: 1 })).toBe(
			'/search?q=soup&sort=newest'
		);
		expect(recipeSearchHref({ tags: [], sort: 'title', page: 3 })).toBe(
			'/search?sort=title&page=3'
		);
	});

	it('round-trips through the parser', () => {
		const query = new URL(recipeSearchHref(fullState), 'https://recipes.example.com').search;

		expect(parse(query)).toEqual(fullState);
	});
});

describe('carriedSearchParams', () => {
	it('carries everything but the edited fields, and never the page', () => {
		expect(
			carriedSearchParams(fullState, [
				'tags',
				'source',
				'contributorId',
				'maxTotalMinutes',
				'addedWithin',
			])
		).toEqual([
			{ name: 'q', value: 'brown butter' },
			{ name: 'sort', value: 'title' },
		]);
	});

	it('leaves out a default order, so clearing the query falls back to newest first', () => {
		expect(
			carriedSearchParams({ text: 'soup', tags: ['Soup'], sort: 'relevance', page: 2 }, ['text'])
		).toEqual([{ name: 'tag', value: 'Soup' }]);
	});
});

describe('recipeSearchSortsFor', () => {
	it('offers best match only with a query', () => {
		expect(recipeSearchSortsFor('soup')).toEqual(['relevance', 'newest', 'title']);
		expect(recipeSearchSortsFor(undefined)).toEqual(['newest', 'title']);
	});
});

describe('appliedFilterCount', () => {
	it('counts each tag and each chosen filter, but not the query or the order', () => {
		expect(appliedFilterCount(fullState)).toBe(6);
		expect(appliedFilterCount({ text: 'soup', tags: [], sort: 'title', page: 1 })).toBe(0);
	});
});

describe('withoutFilters', () => {
	it('keeps the query and the order and returns to the first page', () => {
		expect(withoutFilters(fullState)).toEqual({
			text: 'brown butter',
			tags: [],
			sort: 'title',
			page: 1,
		});
	});
});

describe('toRecipeSearchInput', () => {
	it('asks for one page of results in an explicit order', () => {
		expect(toRecipeSearchInput(fullState, 24)).toEqual({
			text: 'brown butter',
			tags: ['Baking', 'Make ahead'],
			source: 'Aunt June',
			contributorId: adaId,
			maxTotalMinutes: 60,
			addedWithin: 'month',
			sort: 'title',
			limit: 24,
			offset: 24,
		});
	});
});
