import { describe, expect, it } from 'vitest';
import {
	holidayLabels,
	holidayListSchema,
	holidays,
	holidaysFromKeywords,
	type Holiday,
} from '@/domain/recipe/holiday';

describe('holidays', () => {
	it('runs in calendar order', () => {
		expect(holidays.map((holiday) => holidayLabels[holiday])).toEqual([
			'New Year’s Day',
			'St. Patrick’s Day',
			'Easter',
			'Fourth of July',
			'Halloween',
			'Thanksgiving',
			'Christmas',
		]);
	});
});

describe('holidaysFromKeywords', () => {
	it.each<[string, Holiday]>([
		['New Year’s Day', 'new-years-day'],
		["new year's", 'new-years-day'],
		['New Years Eve', 'new-years-day'],
		['St. Patrick’s Day', 'st-patricks-day'],
		['st patricks day', 'st-patricks-day'],
		['Saint Patrick’s Day', 'st-patricks-day'],
		["St. Paddy's Day", 'st-patricks-day'],
		['Easter', 'easter'],
		['Fourth of July', 'fourth-of-july'],
		['4th of July', 'fourth-of-july'],
		['July 4th', 'fourth-of-july'],
		['Independence Day', 'fourth-of-july'],
		['Halloween', 'halloween'],
		['Thanksgiving', 'thanksgiving'],
		['Christmas', 'christmas'],
		['xmas', 'christmas'],
		['X-Mas', 'christmas'],
	])('reads %j as %s', (keyword, holiday) => {
		expect(holidaysFromKeywords([keyword])).toEqual([holiday]);
	});

	it('finds a holiday named inside a keyword', () => {
		expect(holidaysFromKeywords(['Christmas cookies'])).toEqual(['christmas']);
		expect(holidaysFromKeywords(['easy 4th of july dessert'])).toEqual(['fourth-of-july']);
	});

	it('finds a holiday named past a slug’s length in a long keyword', () => {
		const keyword = 'make-ahead family dinner for a crowd with leftovers to spare at Thanksgiving';
		expect(holidaysFromKeywords([keyword])).toEqual(['thanksgiving']);
	});

	it('finds a holiday only as whole words', () => {
		expect(holidaysFromKeywords(['Eastern European', 'Christmastime', 'Lunar New Year'])).toEqual(
			[]
		);
	});

	it('lists each holiday once, in calendar order', () => {
		expect(
			holidaysFromKeywords(['xmas', 'Thanksgiving sides', 'Christmas cookies', 'easter brunch'])
		).toEqual(['easter', 'thanksgiving', 'christmas']);
	});

	it('finds none in keywords that name no holiday', () => {
		expect(holidaysFromKeywords(['weeknight', 'chicken', ''])).toEqual([]);
		expect(holidaysFromKeywords([])).toEqual([]);
	});
});

describe('holidayListSchema', () => {
	it('keeps each holiday once, in calendar order', () => {
		expect(holidayListSchema.parse(['christmas', 'easter', 'christmas'])).toEqual([
			'easter',
			'christmas',
		]);
	});

	it('refuses a holiday outside the vocabulary', () => {
		expect(holidayListSchema.safeParse(['hanukkah']).success).toBe(false);
	});
});
