import { describe, expect, it } from 'vitest';
import {
	appliedFilterCount,
	carriedSearchParams,
	defaultSearchSort,
	parseRecipeSearchParams,
	recipesCanonical,
	recipeSearchFiltersKey,
	recipeSearchHref,
	recipeSearchSortsFor,
	recipesView,
	recipesViewName,
	toRecipeSearchInput,
	withChapter,
	withoutChapter,
	withoutFilters,
	withoutText,
	type RecipeSearchState,
} from '@/components/search/search-params';
import { routeSearchParams } from '@/lib/url-query';

function parse(query: string): RecipeSearchState | null {
	return parseRecipeSearchParams(routeSearchParams(new URLSearchParams(query)));
}

// The state of a URL the parser accepts.
function parsed(query: string): RecipeSearchState {
	const state = parse(query);
	if (state === null) {
		throw new Error(`The parameters ${query} were refused.`);
	}
	return state;
}

const adaId = '0199c7a4-2c3e-7b1a-9f00-2a7c1e4b5d6e';

const fullState: RecipeSearchState = {
	text: 'brown butter',
	chapter: 'cookies-candy',
	holidays: ['easter', 'christmas'],
	diets: ['vegetarian', 'gluten-free'],
	source: 'Aunt June',
	contributorId: adaId,
	maxTotalMinutes: 60,
	sort: 'title',
	page: 2,
};

describe('parseRecipeSearchParams', () => {
	it('lists every recipe newest first when nothing is asked for', () => {
		expect(parse('')).toEqual({ holidays: [], diets: [], sort: 'newest', page: 1 });
	});

	it('lists a chapter A to Z', () => {
		expect(parse('chapter=desserts')).toEqual({
			chapter: 'desserts',
			holidays: [],
			diets: [],
			sort: 'title',
			page: 1,
		});
	});

	it('ranks by best match with words, in a chapter too', () => {
		expect(parse('q=soup')).toEqual({
			text: 'soup',
			holidays: [],
			diets: [],
			sort: 'relevance',
			page: 1,
		});
		expect(parse('q=soup&chapter=soups-salads')?.sort).toBe('relevance');
	});

	it('reads every parameter', () => {
		expect(
			parse(
				`q=brown+butter&chapter=cookies-candy&holiday=easter&holiday=christmas&diet=vegetarian&diet=gluten-free&time=60&source=Aunt+June&contributor=${adaId}&sort=title&page=2`
			)
		).toEqual(fullState);
	});

	it('treats the empty values a form submits as absent', () => {
		expect(parse('q=&chapter=&holiday=&diet=&source=&contributor=&time=&sort=&page=')).toEqual({
			holidays: [],
			diets: [],
			sort: 'newest',
			page: 1,
		});
	});

	it('trims the query and the source, so spaces alone are absent', () => {
		expect(parse('q=++soup++&source=+Aunt+June+')).toMatchObject({
			text: 'soup',
			source: 'Aunt June',
		});
		expect(parse('q=+++')).toEqual({ holidays: [], diets: [], sort: 'newest', page: 1 });
	});

	it('lowercases the contributor id, as the filters list it', () => {
		expect(parse(`contributor=+${adaId.toUpperCase()}+`)?.contributorId).toBe(adaId);
	});

	it('lists each holiday and diet once, in the vocabulary’s order', () => {
		expect(
			parse('holiday=christmas&holiday=easter&holiday=christmas&diet=dairy-free&diet=vegan')
		).toMatchObject({ holidays: ['easter', 'christmas'], diets: ['vegan', 'dairy-free'] });
	});

	it('ignores parameters it does not know, such as older links’ tags and date filter', () => {
		expect(parse('q=soup&ref=share&tag=Dessert&added=week')).toEqual({
			text: 'soup',
			holidays: [],
			diets: [],
			sort: 'relevance',
			page: 1,
		});
	});

	it('takes any order the view offers, its default included', () => {
		expect(parse('sort=newest')?.sort).toBe('newest');
		expect(parse('sort=title')?.sort).toBe('title');
		expect(parse('chapter=desserts&sort=newest')?.sort).toBe('newest');
		expect(parse('chapter=desserts&sort=title')?.sort).toBe('title');
		expect(parse('q=soup&sort=relevance')?.sort).toBe('relevance');
		expect(parse('q=soup&chapter=desserts&sort=title')?.sort).toBe('title');
	});

	it.each([
		['an unknown chapter', 'chapter=nope'],
		['a chapter by its label', 'chapter=Desserts'],
		['a repeated chapter', 'chapter=desserts&chapter=desserts'],
		['an unknown holiday among known ones', 'holiday=easter&holiday=boxing-day'],
		['an unknown diet', 'diet=nut-free'],
		['an unknown total time', 'time=45'],
		['a repeated total time', 'time=30&time=60'],
		['an unknown order', 'sort=oldest'],
		['a repeated order', 'sort=title&sort=newest'],
		['best match without words', 'sort=relevance'],
		['best match in a chapter without words', 'chapter=desserts&sort=relevance'],
		['an invalid page', 'page=0'],
		['a repeated page', 'page=2&page=3'],
		['a repeated query', 'q=soup&q=stew'],
		['a repeated source', 'source=Aunt+June&source=Grandpa+Lou'],
		['a repeated contributor', `contributor=${adaId}&contributor=${adaId}`],
	])('refuses %s', (_case, query) => {
		expect(parse(query)).toBeNull();
	});
});

describe('defaultSearchSort', () => {
	it('ranks by best match with words, lists a chapter A to Z, and every recipe newest first', () => {
		expect(defaultSearchSort({ text: 'soup' })).toBe('relevance');
		expect(defaultSearchSort({ text: 'soup', chapter: 'desserts' })).toBe('relevance');
		expect(defaultSearchSort({ chapter: 'desserts' })).toBe('title');
		expect(defaultSearchSort({})).toBe('newest');
	});
});

describe('recipeSearchHref', () => {
	it('links every recipe and a chapter bare, in their default order', () => {
		expect(recipeSearchHref({ holidays: [], diets: [], sort: 'newest', page: 1 })).toBe('/');
		expect(
			recipeSearchHref({ chapter: 'desserts', holidays: [], diets: [], sort: 'title', page: 1 })
		).toBe('/?chapter=desserts');
	});

	it('links a view with its words and filters', () => {
		expect(
			recipeSearchHref({
				chapter: 'desserts',
				holidays: ['christmas'],
				diets: [],
				sort: 'title',
				page: 1,
			})
		).toBe('/?chapter=desserts&holiday=christmas');
		expect(
			recipeSearchHref({
				text: 'lemon',
				chapter: 'desserts',
				holidays: [],
				diets: [],
				sort: 'relevance',
				page: 1,
			})
		).toBe('/?q=lemon&chapter=desserts');
	});

	it('lists parameters in a fixed order and leaves out the default order and first page', () => {
		expect(recipeSearchHref({ ...fullState, sort: 'relevance', page: 1 })).toBe(
			`/?q=brown+butter&chapter=cookies-candy&holiday=easter&holiday=christmas&diet=vegetarian&diet=gluten-free&time=60&source=Aunt+June&contributor=${adaId}`
		);
	});

	it('keeps an order that differs from the view’s default', () => {
		expect(recipeSearchHref({ holidays: [], diets: [], sort: 'title', page: 3 })).toBe(
			'/?sort=title&page=3'
		);
		expect(
			recipeSearchHref({ chapter: 'desserts', holidays: [], diets: [], sort: 'newest', page: 1 })
		).toBe('/?chapter=desserts&sort=newest');
		expect(
			recipeSearchHref({ text: 'soup', holidays: [], diets: [], sort: 'newest', page: 1 })
		).toBe('/?q=soup&sort=newest');
		expect(
			recipeSearchHref({
				text: 'soup',
				chapter: 'desserts',
				holidays: [],
				diets: [],
				sort: 'title',
				page: 1,
			})
		).toBe('/?q=soup&chapter=desserts&sort=title');
	});

	it('gives each view one URL, whatever order its parameters came in or the defaults they named', () => {
		expect(recipeSearchHref(parsed('page=1&sort=newest'))).toBe('/');
		expect(recipeSearchHref(parsed('sort=title&page=1&chapter=desserts'))).toBe(
			'/?chapter=desserts'
		);
		expect(recipeSearchHref(parsed('sort=relevance&chapter=desserts&q=lemon'))).toBe(
			'/?q=lemon&chapter=desserts'
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
				'chapter',
				'holidays',
				'diets',
				'source',
				'contributorId',
				'maxTotalMinutes',
			])
		).toEqual([
			{ name: 'q', value: 'brown butter' },
			{ name: 'sort', value: 'title' },
		]);
	});

	it('leaves out the view’s default order, so a new query ranks by best match', () => {
		expect(carriedSearchParams(parsed('chapter=soups-salads&page=2'), ['text'])).toEqual([
			{ name: 'chapter', value: 'soups-salads' },
		]);
	});
});

describe('recipeSearchSortsFor', () => {
	it('offers best match only with a query', () => {
		expect(recipeSearchSortsFor('soup')).toEqual(['relevance', 'newest', 'title']);
		expect(recipeSearchSortsFor(undefined)).toEqual(['newest', 'title']);
	});
});

describe('appliedFilterCount', () => {
	it('counts each holiday and diet and each chosen filter, but not the chapter, the words, or the order', () => {
		expect(appliedFilterCount(fullState)).toBe(7);
		expect(appliedFilterCount(parsed('q=soup&chapter=desserts&sort=newest'))).toBe(0);
	});
});

describe('withChapter', () => {
	it('keeps the words, the filters, and an order chosen with them, from the first page', () => {
		expect(withChapter(fullState, 'desserts')).toEqual({
			...fullState,
			chapter: 'desserts',
			page: 1,
		});
	});

	it('gives every recipe’s newest first way to the chapter’s A to Z', () => {
		expect(recipeSearchHref(withChapter(parsed('holiday=easter&page=3'), 'desserts'))).toBe(
			'/?chapter=desserts&holiday=easter'
		);
		expect(withChapter(parsed(''), 'desserts').sort).toBe('title');
	});

	it('keeps an order chosen apart from the view’s default, leaving it out where it is the chapter’s', () => {
		expect(recipeSearchHref(withChapter(parsed('sort=title'), 'desserts'))).toBe(
			'/?chapter=desserts'
		);
		expect(
			recipeSearchHref(withChapter(parsed('chapter=desserts&sort=newest'), 'breads-rolls'))
		).toBe('/?chapter=breads-rolls&sort=newest');
	});

	it('keeps best match with the words', () => {
		expect(recipeSearchHref(withChapter(parsed('q=lemon'), 'desserts'))).toBe(
			'/?q=lemon&chapter=desserts'
		);
	});
});

describe('withoutChapter', () => {
	it('keeps the words, the filters, and an order chosen with them, from the first page', () => {
		expect(withoutChapter(fullState)).toEqual({ ...fullState, chapter: undefined, page: 1 });
	});

	it('gives the chapter’s A to Z way to every recipe’s newest first', () => {
		expect(recipeSearchHref(withoutChapter(parsed('chapter=desserts&diet=vegan&page=2')))).toBe(
			'/?diet=vegan'
		);
	});

	it('leaves out newest first chosen in a chapter, since every recipe lists that way', () => {
		expect(recipeSearchHref(withoutChapter(parsed('chapter=desserts&sort=newest')))).toBe('/');
	});

	it('forgets A to Z chosen for every recipe once a chapter has made it the default', () => {
		const inDesserts = withChapter(parsed('sort=title'), 'desserts');

		expect(recipeSearchHref(withoutChapter(inDesserts))).toBe('/');
	});

	it('keeps best match with the words', () => {
		expect(recipeSearchHref(withoutChapter(parsed('q=lemon&chapter=desserts')))).toBe('/?q=lemon');
	});
});

describe('withoutText', () => {
	it('keeps the chapter, the filters, and an order chosen with the words, from the first page', () => {
		expect(withoutText(fullState)).toEqual({ ...fullState, text: undefined, page: 1 });
		expect(recipeSearchHref(withoutText(parsed('q=lemon&sort=title&page=2')))).toBe('/?sort=title');
		expect(recipeSearchHref(withoutText(parsed('q=lemon&chapter=desserts&sort=newest')))).toBe(
			'/?chapter=desserts&sort=newest'
		);
	});

	it('turns best match, which ranks by the words, into the view’s default order', () => {
		expect(withoutText(parsed('q=lemon&holiday=easter'))).toEqual({
			text: undefined,
			holidays: ['easter'],
			diets: [],
			sort: 'newest',
			page: 1,
		});
		expect(recipeSearchHref(withoutText(parsed('q=lemon&chapter=desserts&page=2')))).toBe(
			'/?chapter=desserts'
		);
	});

	it('leaves out an order the view lists by anyway', () => {
		expect(recipeSearchHref(withoutText(parsed('q=lemon&chapter=desserts&sort=title')))).toBe(
			'/?chapter=desserts'
		);
	});
});

describe('withoutFilters', () => {
	it('keeps the words, the chapter, and the order, from the first page', () => {
		expect(withoutFilters(fullState)).toEqual({
			text: 'brown butter',
			chapter: 'cookies-candy',
			holidays: [],
			diets: [],
			sort: 'title',
			page: 1,
		});
		expect(
			recipeSearchHref(withoutFilters(parsed('chapter=desserts&holiday=easter&sort=newest&page=2')))
		).toBe('/?chapter=desserts&sort=newest');
	});
});

describe('recipeSearchFiltersKey', () => {
	it('stays the same when only the order or the page changes', () => {
		expect(recipeSearchFiltersKey({ ...fullState, sort: 'newest', page: 1 })).toBe(
			recipeSearchFiltersKey(fullState)
		);
	});

	it('changes with the words, the chapter, or a filter', () => {
		const key = recipeSearchFiltersKey(fullState);

		expect(recipeSearchFiltersKey({ ...fullState, text: 'butter' })).not.toBe(key);
		expect(recipeSearchFiltersKey({ ...fullState, chapter: 'desserts' })).not.toBe(key);
		expect(recipeSearchFiltersKey({ ...fullState, holidays: ['easter'] })).not.toBe(key);
		expect(recipeSearchFiltersKey({ ...fullState, diets: ['vegetarian'] })).not.toBe(key);
		expect(recipeSearchFiltersKey({ ...fullState, maxTotalMinutes: undefined })).not.toBe(key);
	});
});

describe('recipesView', () => {
	it('opens every recipe and each chapter unfiltered, in its default order, from the first page', () => {
		expect(recipesView()).toEqual(parsed(''));
		expect(recipesView('desserts')).toEqual(parsed('chapter=desserts'));
		expect(recipeSearchHref(recipesView('desserts'))).toBe('/?chapter=desserts');
		expect(recipeSearchHref({ ...recipesView(), holidays: ['easter'] })).toBe('/?holiday=easter');
	});
});

describe('recipesViewName', () => {
	it('names every recipe All Recipes, whatever the filters, order, or page', () => {
		const allRecipes = {
			heading: 'All Recipes',
			title: 'All Recipes',
			backLabel: 'Back to All Recipes',
		};

		expect(recipesViewName(parsed(''))).toEqual(allRecipes);
		expect(recipesViewName(parsed('holiday=easter&sort=title&page=2'))).toEqual(allRecipes);
	});

	it('names a chapter by its label', () => {
		expect(recipesViewName(parsed('chapter=vegetables-sides&diet=vegan'))).toEqual({
			heading: 'Vegetables & Side Dishes',
			title: 'Vegetables & Side Dishes',
			backLabel: 'Back to Vegetables & Side Dishes',
		});
	});

	it('heads a search by its view, titles it by its words and chapter, and returns to its results', () => {
		expect(recipesViewName(parsed('q=lemon&holiday=easter'))).toEqual({
			heading: 'All Recipes',
			title: 'Search results for “lemon”',
			backLabel: 'Back to search results',
		});
		expect(recipesViewName(parsed('q=lemon&chapter=desserts'))).toEqual({
			heading: 'Desserts',
			title: 'Search results for “lemon” in Desserts',
			backLabel: 'Back to search results',
		});
	});
});

describe('recipesCanonical', () => {
	it('lists every recipe and each chapter as themselves', () => {
		expect(recipesCanonical(parsed(''))).toEqual({ href: '/', indexed: true });
		expect(recipesCanonical(parsed('chapter=desserts'))).toEqual({
			href: '/?chapter=desserts',
			indexed: true,
		});
	});

	it('names their normalized URL, with any other order and page', () => {
		expect(recipesCanonical(parsed('page=1&sort=newest'))).toEqual({ href: '/', indexed: true });
		expect(recipesCanonical(parsed('chapter=desserts&sort=newest&page=2'))).toEqual({
			href: '/?chapter=desserts&sort=newest&page=2',
			indexed: true,
		});
	});

	it('keeps a view with words or filters out, naming its chapter or every recipe as a link opens it', () => {
		expect(recipesCanonical(parsed('q=lemon&page=2'))).toEqual({ href: '/', indexed: false });
		expect(recipesCanonical(parsed('q=lemon&chapter=desserts&sort=newest'))).toEqual({
			href: '/?chapter=desserts',
			indexed: false,
		});
		expect(recipesCanonical(parsed('diet=vegan&sort=title'))).toEqual({
			href: '/',
			indexed: false,
		});
		expect(recipesCanonical(parsed('chapter=desserts&holiday=easter&sort=newest&page=2'))).toEqual({
			href: '/?chapter=desserts',
			indexed: false,
		});
	});
});

describe('toRecipeSearchInput', () => {
	it('asks for one page of results in an explicit order', () => {
		expect(toRecipeSearchInput(fullState, 24)).toEqual({
			text: 'brown butter',
			chapter: 'cookies-candy',
			holidays: ['easter', 'christmas'],
			diets: ['vegetarian', 'gluten-free'],
			source: 'Aunt June',
			contributorId: adaId,
			maxTotalMinutes: 60,
			sort: 'title',
			limit: 24,
			offset: 24,
		});
	});
});
