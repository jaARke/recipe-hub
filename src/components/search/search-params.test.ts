import { describe, expect, it } from 'vitest';
import {
	appliedFilterCount,
	carriedSearchParams,
	misplacedRecipeSearchHref,
	parseRecipeSearchParams,
	recipeSearchFiltersKey,
	recipeSearchHref,
	recipeSearchModePath,
	recipeSearchSortsFor,
	toRecipeSearchInput,
	withoutFilters,
	withoutText,
	type RecipeSearchState,
} from '@/components/search/search-params';
import { routeSearchParams } from '@/lib/url-query';

function parse(query: string): RecipeSearchState | null {
	return parseRecipeSearchParams(routeSearchParams(new URLSearchParams(query)));
}

function misplaced(path: string): string | undefined {
	const url = new URL(path, 'https://recipes.example.com');
	return misplacedRecipeSearchHref(url.pathname, routeSearchParams(url.searchParams));
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
	it('links bare Browse when nothing is asked for', () => {
		expect(recipeSearchHref({ tags: [], sort: 'newest', page: 1 })).toBe('/');
	});

	it('links Browse with its filters without words, and Search with them', () => {
		expect(recipeSearchHref({ tags: ['Dessert', 'Make ahead'], sort: 'newest', page: 1 })).toBe(
			'/?tag=Dessert&tag=Make+ahead'
		);
		expect(recipeSearchHref({ text: 'lemon', tags: ['Dessert'], sort: 'relevance', page: 1 })).toBe(
			'/search?q=lemon&tag=Dessert'
		);
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
		expect(recipeSearchHref({ tags: [], sort: 'title', page: 3 })).toBe('/?sort=title&page=3');
	});

	it('round-trips through the parser', () => {
		const query = new URL(recipeSearchHref(fullState), 'https://recipes.example.com').search;

		expect(parse(query)).toEqual(fullState);
	});
});

describe('recipeSearchModePath', () => {
	it('submits a search without words to Browse and one with them to Search', () => {
		expect(recipeSearchModePath({})).toBe('/');
		expect(recipeSearchModePath({ text: 'lemon' })).toBe('/search');
	});
});

describe('misplacedRecipeSearchHref', () => {
	it('sends a search without words to Browse with its filters', () => {
		expect(misplaced('/search?tag=Dessert')).toBe('/?tag=Dessert');
		expect(misplaced('/search')).toBe('/');
	});

	it('sends an emptied search to Browse with its filters and its order, its default left out', () => {
		expect(misplaced('/search?q=&tag=Dessert&sort=title')).toBe('/?tag=Dessert&sort=title');
		expect(misplaced('/search?q=+&tag=Dessert&sort=newest')).toBe('/?tag=Dessert');
	});

	it('sends Browse given words to Search with its filters', () => {
		expect(misplaced('/?q=lemon')).toBe('/search?q=lemon');
		expect(misplaced('/?q=lemon&tag=Dessert')).toBe('/search?q=lemon&tag=Dessert');
	});

	it('leaves Browse without words and Search with them where they are', () => {
		expect(misplaced('/?tag=Dessert&sort=title')).toBeUndefined();
		expect(misplaced('/?q=')).toBeUndefined();
		expect(misplaced('/search?q=lemon&tag=Dessert')).toBeUndefined();
	});

	it('leaves parameters it refuses to the page, which answers them with a 404', () => {
		expect(misplaced('/search?sort=relevance&tag=Dessert')).toBeUndefined();
		expect(misplaced('/?q=lemon&q=lime')).toBeUndefined();
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

describe('withoutText', () => {
	it('keeps the filters and returns to the first page', () => {
		expect(withoutText(fullState)).toEqual({ ...fullState, text: undefined, page: 1 });
	});

	it('turns best match, which ranks by the words, into newest first', () => {
		expect(withoutText({ text: 'lemon', tags: ['Dessert'], sort: 'relevance', page: 2 })).toEqual({
			text: undefined,
			tags: ['Dessert'],
			sort: 'newest',
			page: 1,
		});
	});
});

describe('recipeSearchFiltersKey', () => {
	it('stays the same when only the order or the page changes', () => {
		expect(recipeSearchFiltersKey({ ...fullState, sort: 'newest', page: 1 })).toBe(
			recipeSearchFiltersKey(fullState)
		);
	});

	it('changes with the words or a filter', () => {
		const key = recipeSearchFiltersKey(fullState);

		expect(recipeSearchFiltersKey({ ...fullState, text: 'butter' })).not.toBe(key);
		expect(recipeSearchFiltersKey({ ...fullState, tags: ['Baking'] })).not.toBe(key);
		expect(recipeSearchFiltersKey({ ...fullState, addedWithin: undefined })).not.toBe(key);
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
