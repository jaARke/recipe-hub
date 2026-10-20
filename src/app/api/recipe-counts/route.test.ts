import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { recipeCacheTags } from '@/app/_lib/recipe-cache';
import { GET } from '@/app/api/recipe-counts/route';
import type { RecipeSearchFacets } from '@/application/ports/recipe-search';
import { RecipeSearchService } from '@/application/search/recipe-search-service';
import { FixedRecipeSearch, noRecipeSearchFacets } from '@/application/testing/fixed-recipe-search';
import { memberIdSchema } from '@/domain/member/member';

const services = vi.hoisted(() => ({ searchService: undefined as unknown }));
const cache = vi.hoisted(() => ({ lives: [] as unknown[], tags: [] as string[] }));

// Outside Next's cache, cacheLife and cacheTag throw, so these record what a cached read asks of them.
vi.mock('next/cache', () => ({
	cacheLife: (life: unknown) => {
		cache.lives.push(life);
	},
	cacheTag: (...tags: string[]) => {
		cache.tags.push(...tags);
	},
}));

vi.mock('@/composition/services', () => ({
	getRecipeSearchService: () => services.searchService,
}));

const adaId = memberIdSchema.parse('0199c7a4-2c3e-7b1a-9f00-2a7c1e4b5d6e');

// Two desserts, both Ada's.
const facets: RecipeSearchFacets = {
	...noRecipeSearchFacets,
	allRecipes: 5,
	chapters: { ...noRecipeSearchFacets.chapters, desserts: 2, 'soups-salads': 3 },
	holidays: { ...noRecipeSearchFacets.holidays, christmas: 1 },
	sources: [{ label: 'Tante Hélène', count: 1 }],
	contributors: [{ memberId: adaId, displayName: 'Ada', count: 2 }],
};

// The route's service over a search that counts two recipes and records what it was asked.
function countTwoRecipes(): FixedRecipeSearch {
	const search = new FixedRecipeSearch({ hits: [], total: 2, match: 'exact', facets });
	services.searchService = new RecipeSearchService(search);
	return search;
}

function requestCounts(query: string): Promise<Response> {
	return GET(new NextRequest(`http://localhost/api/recipe-counts${query}`));
}

describe('the recipe counts route', () => {
	beforeEach(() => {
		services.searchService = undefined;
		cache.lives = [];
		cache.tags = [];
	});

	it("answers the total and every option's count for a chapter, from the cache recipe and member changes clear", async () => {
		const search = countTwoRecipes();

		const response = await requestCounts('?chapter=desserts');

		expect(response.status).toBe(200);
		expect(response.headers.get('Content-Type')).toBe('application/json');
		expect(response.headers.get('Cache-Control')).toBe('no-store');
		expect(await response.json()).toEqual({ total: 2, counts: facets });
		expect(search.receivedCountQueries).toEqual([{ chapter: 'desserts', holidays: [], diets: [] }]);
		expect(search.receivedQueries).toEqual([]);
		expect(cache.lives).toEqual(['days']);
		expect(cache.tags).toEqual([recipeCacheTags.list, recipeCacheTags.memberNames]);
	});

	it('counts the words and filters afresh, leaving out the order and page', async () => {
		const search = countTwoRecipes();

		const response = await requestCounts(
			`?q=pie&chapter=desserts&holiday=christmas&diet=vegan&source=Tante+H%C3%A9l%C3%A8ne&contributor=${adaId}&time=60&sort=title&page=2`
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ total: 2, counts: facets });
		expect(search.receivedCountQueries).toEqual([
			{
				text: { text: 'pie', includedWords: ['pie'], excludedTerms: [] },
				chapter: 'desserts',
				holidays: ['christmas'],
				diets: ['vegetarian', 'vegan', 'dairy-free'],
				source: 'Tante Hélène',
				contributorId: adaId,
				maxTotalMinutes: 60,
			},
		]);
		expect(cache.lives).toEqual([]);
	});

	it.each([
		['an unknown chapter', '?chapter=soups'],
		['an unknown holiday', '?holiday=boxing-day'],
		['a total time that is not a choice', '?time=45'],
		['a repeated query', '?q=pie&q=cake'],
		['best match without words', '?sort=relevance'],
		['a page that is not a number', '?page=two'],
	])('answers %s with a 404 no cache keeps, counting nothing', async (_, query) => {
		const search = countTwoRecipes();

		const response = await requestCounts(query);

		expect(response.status).toBe(404);
		expect(response.headers.get('Cache-Control')).toBe('no-store');
		expect(search.receivedCountQueries).toEqual([]);
	});

	it.each([
		['a query the search refuses', `?q=${'a'.repeat(201)}`],
		['a contributor who is no member', '?contributor=0199c7a4-2c3e-7b1a-9f00-000000000000'],
	])('answers %s with a 404 no cache keeps', async (_, query) => {
		countTwoRecipes();

		const response = await requestCounts(query);

		expect(response.status).toBe(404);
		expect(response.headers.get('Cache-Control')).toBe('no-store');
	});
});
