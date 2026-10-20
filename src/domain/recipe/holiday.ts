import { z } from 'zod';
import { slugKey } from '@/domain/recipe/slug';

// In calendar order.
export const holidays = [
	'new-years-day',
	'st-patricks-day',
	'easter',
	'fourth-of-july',
	'halloween',
	'thanksgiving',
	'christmas',
] as const;
export type Holiday = (typeof holidays)[number];

// The holidays given, once each, in calendar order.
export function inHolidayOrder(given: readonly Holiday[]): Holiday[] {
	return holidays.filter((holiday) => given.includes(holiday));
}

export const holidayListSchema = z.array(z.enum(holidays)).overwrite(inHolidayOrder);

export const holidayLabels = {
	'new-years-day': 'New Year’s Day',
	'st-patricks-day': 'St. Patrick’s Day',
	easter: 'Easter',
	'fourth-of-july': 'Fourth of July',
	halloween: 'Halloween',
	thanksgiving: 'Thanksgiving',
	christmas: 'Christmas',
} as const satisfies Record<Holiday, string>;

// The phrases an imported page's keywords name each holiday by. A keyword names one when it holds a
// phrase as whole words, so "Christmas cookies" names Christmas; case and punctuation don't count.
const holidayKeywordHints = {
	// Not "new year", which "Lunar New Year" holds.
	'new-years-day': ['new year’s'],
	'st-patricks-day': ['st patrick’s', 'saint patrick’s', 'st paddy’s', 'st patty’s'],
	easter: ['easter'],
	'fourth-of-july': [
		'fourth of july',
		'4th of july',
		'july fourth',
		'july 4',
		'july 4th',
		'independence day',
	],
	halloween: ['halloween'],
	thanksgiving: ['thanksgiving'],
	christmas: ['christmas', 'xmas', 'x-mas'],
} as const satisfies Record<Holiday, readonly string[]>;

// Bounded by hyphens, so a slug holds a phrase only as whole words.
function holdsPhrase(keyword: string, phrase: string): boolean {
	return `-${slugKey(keyword)}-`.includes(`-${slugKey(phrase)}-`);
}

// The holidays a page's keywords name, once each, in calendar order. Each entry is one keyword, so a
// value listing several with commas is split first.
export function holidaysFromKeywords(keywords: readonly string[]): Holiday[] {
	return holidays.filter((holiday) =>
		holidayKeywordHints[holiday].some((hint) =>
			keywords.some((keyword) => holdsPhrase(keyword, hint))
		)
	);
}
