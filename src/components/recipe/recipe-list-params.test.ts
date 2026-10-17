import { describe, expect, it } from 'vitest';
import {
	favoriteListHref,
	parseOptionParam,
	parsePageParam,
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

describe('favoriteListHref', () => {
	it('links the first page bare and a later one by its number', () => {
		expect(favoriteListHref(1)).toBe('/favorites');
		expect(favoriteListHref(3)).toBe('/favorites?page=3');
	});
});
