import { describe, expect, it } from 'vitest';
import {
	parseOptionParam,
	parsePageParam,
	parseRecipeListParams,
	recipeListHref,
	singleParam,
} from '@/components/recipe/recipe-list-params';

describe('singleParam', () => {
	it('reads one value, treats an empty one as absent, and refuses a repeat', () => {
		expect(singleParam('soup')).toBe('soup');
		expect(singleParam('')).toBeUndefined();
		expect(singleParam(undefined)).toBeUndefined();
		expect(singleParam(['1', '2'])).toBeNull();
	});
});

describe('parsePageParam', () => {
	it.each([
		[undefined, 1],
		['', 1],
		['1', 1],
		['12', 12],
		['0', null],
		['01', null],
		['-2', null],
		['2.5', null],
		['two', null],
		[['2', '3'], null],
	])('reads %j as %j', (value, expected) => {
		expect(parsePageParam(value)).toBe(expected);
	});
});

describe('parseOptionParam', () => {
	it('matches an option by its URL form, numbers included', () => {
		expect(parseOptionParam('title', ['newest', 'title'])).toBe('title');
		expect(parseOptionParam('30', [15, 30, 60])).toBe(30);
	});

	it('leaves an absent value undefined and refuses anything else', () => {
		expect(parseOptionParam(undefined, ['newest'])).toBeUndefined();
		expect(parseOptionParam('', ['newest'])).toBeUndefined();
		expect(parseOptionParam('oldest', ['newest'])).toBeNull();
		expect(parseOptionParam(['newest', 'newest'], ['newest'])).toBeNull();
	});
});

describe('parseRecipeListParams', () => {
	it('starts on the first page, newest first', () => {
		expect(parseRecipeListParams({})).toEqual({ page: 1, sort: 'newest' });
	});

	it('reads the page and the order, ignoring other parameters', () => {
		expect(parseRecipeListParams({ page: '3', sort: 'title', ref: 'share' })).toEqual({
			page: 3,
			sort: 'title',
		});
	});

	it('refuses an unknown order or an invalid page', () => {
		expect(parseRecipeListParams({ sort: 'relevance' })).toBeNull();
		expect(parseRecipeListParams({ page: '0' })).toBeNull();
	});
});

describe('recipeListHref', () => {
	it.each([
		[1, 'newest', '/'],
		[2, 'newest', '/?page=2'],
		[1, 'title', '/?sort=title'],
		[3, 'title', '/?sort=title&page=3'],
	] as const)('links page %s in %s order to %s', (page, sort, expected) => {
		expect(recipeListHref({ page, sort })).toBe(expected);
	});

	it('round-trips through the parser', () => {
		const state = { page: 4, sort: 'title' } as const;
		const params = Object.fromEntries(
			new URL(recipeListHref(state), 'https://recipes.example.com').searchParams
		);

		expect(parseRecipeListParams(params)).toEqual(state);
	});
});
