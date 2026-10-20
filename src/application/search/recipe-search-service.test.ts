import { describe, expect, it } from 'vitest';
import type {
	HighlightedText,
	RecipeSearchFacets,
	RecipeSearchResults,
} from '@/application/ports/recipe-search';
import { InvalidRecipeSearchError } from '@/application/search/errors';
import type { RecipeSearchInput } from '@/application/search/recipe-search-dtos';
import { RecipeSearchService } from '@/application/search/recipe-search-service';
import { memberActor } from '@/application/testing/actors';
import { FixedRecipeSearch } from '@/application/testing/fixed-recipe-search';
import { InMemoryRecipeRepository } from '@/application/testing/in-memory-recipe-repository';
import { memberIdSchema } from '@/domain/member/member';
import { parseRecipeContent } from '@/domain/recipe/recipe';
import { sampleChickenSoup } from '@/domain/recipe/samples/sample-recipes';
import { settings } from '@/lib/settings';

const firstPage: RecipeSearchInput = { tags: [], sort: 'relevance', limit: 24, offset: 0 };

const adaId = memberIdSchema.parse('0199c7a4-2c3e-7b1a-9f00-2a7c1e4b5d6e');

const noResults: RecipeSearchResults = {
	hits: [],
	total: 0,
	match: 'exact',
	facets: { tags: [], sources: [], contributors: [] },
};

// The search lists a chosen member who exists, even with no recipe left.
const noResultsByAda: RecipeSearchResults = {
	...noResults,
	facets: {
		...noResults.facets,
		contributors: [{ memberId: adaId, displayName: 'Ada', count: 0 }],
	},
};

function tagLabels(count: number): string[] {
	return Array.from({ length: count }, (_, index) => `Tag ${index}`);
}

// A service over a search that returns the given results and records each query.
function createSearch(results: RecipeSearchResults) {
	const recipes = new FixedRecipeSearch(results);
	return { recipes, service: new RecipeSearchService(recipes) };
}

describe('searchRecipes', () => {
	it('parses the text and normalizes the filters into the query', async () => {
		const { recipes, service } = createSearch(noResultsByAda);

		await service.searchRecipes({
			text: '  chicken -"bay leaf" ',
			tags: [' weeknight', 'So\0up', 'WEEKNIGHT'],
			source: ' Grandpa Lou ',
			contributorId: ` ${adaId.toUpperCase()} `,
			maxTotalMinutes: 60,
			addedWithin: 'month',
			sort: 'title',
			limit: 24,
			offset: 48,
		});

		expect(recipes.receivedQueries).toEqual([
			{
				text: {
					text: 'chicken -"bay leaf"',
					includedWords: ['chicken'],
					excludedTerms: ['"bay leaf"'],
				},
				tags: ['weeknight', 'Soup'],
				source: 'Grandpa Lou',
				contributorId: adaId,
				maxTotalMinutes: 60,
				addedWithin: 'month',
				sort: 'title',
				limit: 24,
				offset: 48,
			},
		]);
	});

	it.each([undefined, '', '   '])('passes no text for the text %o', async (text) => {
		const { recipes, service } = createSearch(noResults);

		await service.searchRecipes({ ...firstPage, text });

		expect(recipes.receivedQueries).toEqual([
			{ tags: [], sort: 'relevance', limit: 24, offset: 0 },
		]);
	});

	it('measures text after trimming and counts tags after dropping repeats', async () => {
		const { recipes, service } = createSearch(noResults);

		await service.searchRecipes({
			...firstPage,
			text: `  ${'a'.repeat(200)}  `,
			tags: [...tagLabels(20), 'tag 0'],
		});

		expect(recipes.receivedQueries).toMatchObject([
			{ text: { text: 'a'.repeat(200) }, tags: tagLabels(20) },
		]);
	});

	it('accepts a source of any length, since the filters offer every source recipes use', async () => {
		const { recipes, service } = createSearch(noResults);

		await service.searchRecipes({ ...firstPage, source: 'a'.repeat(500) });

		expect(recipes.receivedQueries).toMatchObject([{ source: 'a'.repeat(500) }]);
	});

	it('filters by a stored tag or source past the recipe limits, which recipes saved earlier keep', async () => {
		const { recipes, service } = createSearch(noResults);
		const tag = 'a'.repeat(settings.recipeLimits.maxTagLength + 1);
		const source = 'a'.repeat(settings.recipeLimits.maxSourceLength + 1);

		await service.searchRecipes({ ...firstPage, tags: [tag], source });

		expect(recipes.receivedQueries).toMatchObject([{ tags: [tag], source }]);
	});

	it('strips hidden characters from the source, as every recipe text field does', async () => {
		const { recipes, service } = createSearch(noResults);

		await service.searchRecipes({ ...firstPage, source: 'Grandpa\0 Lou\u0007' });

		expect(recipes.receivedQueries).toMatchObject([{ source: 'Grandpa Lou' }]);
	});

	it.each([
		['text over 200 characters', { text: 'a'.repeat(201) }],
		['more than 20 tags', { tags: tagLabels(21) }],
		['a blank tag', { tags: ['Soup', ' '] }],
		['a blank source', { source: ' ' }],
		['a NUL character in the text', { text: 'soup\0' }],
		['a contributor id that is not an id', { contributorId: 'ada' }],
		['a total time that is not a choice', { maxTotalMinutes: 45 }],
		['an unknown window for the date added', { addedWithin: 'day' }],
		['an unknown sort', { sort: 'oldest' }],
		['a limit of 0', { limit: 0 }],
		['a fractional limit', { limit: 1.5 }],
		['a limit over 100', { limit: 101 }],
		['a negative offset', { offset: -1 }],
		['an offset that is not a number', { offset: Number.NaN }],
	])('rejects %s without searching', async (_, overrides) => {
		const { recipes, service } = createSearch(noResults);

		await expect(
			service.searchRecipes({ ...firstPage, ...overrides } as RecipeSearchInput)
		).rejects.toThrow(InvalidRecipeSearchError);
		expect(recipes.receivedQueries).toEqual([]);
	});

	it('rejects a contributor id the facet does not list, since it names no member', async () => {
		const { recipes, service } = createSearch(noResults);

		await expect(service.searchRecipes({ ...firstPage, contributorId: adaId })).rejects.toThrow(
			InvalidRecipeSearchError
		);
		expect(recipes.receivedQueries).toMatchObject([{ contributorId: adaId }]);
	});

	it('returns the page of results, each summarized for its card', async () => {
		const soup = await new InMemoryRecipeRepository().create({
			content: parseRecipeContent(sampleChickenSoup),
			provenance: { entryMode: 'manual' },
			contributorId: memberActor().memberId,
			slugBase: 'weeknight-chicken-soup',
		});
		const title: HighlightedText = [
			{ text: 'Weeknight chicken ', highlighted: false },
			{ text: 'soup', highlighted: true },
		];
		const snippet: HighlightedText = [
			{ text: 'Soup', highlighted: true },
			{ text: ' for a weeknight', highlighted: false },
		];
		const facets: RecipeSearchFacets = {
			tags: [{ label: 'Soup', count: 3 }],
			sources: [{ label: 'Grandpa Lou', count: 1 }],
			contributors: [{ memberId: soup.contributorId, displayName: 'Ada', count: 1 }],
		};
		const { service } = createSearch({
			hits: [{ recipe: soup, title, snippet }],
			total: 25,
			match: 'close',
			facets,
		});

		expect(await service.searchRecipes({ ...firstPage, text: 'sopu' })).toEqual({
			results: [
				{
					recipe: {
						id: soup.id,
						slug: 'weeknight-chicken-soup',
						title: 'Weeknight chicken soup',
						source: 'Grandpa Lou',
						totalMinutes: 50,
						yield: { kind: 'servings', amount: { min: 6 } },
						chapter: 'soups-salads',
						holidays: [],
						diets: [],
						tags: ['Soup', 'Weeknight'],
						coverImage: soup.images[0],
						createdAt: soup.createdAt,
					},
					title,
					snippet,
				},
			],
			total: 25,
			match: 'close',
			facets,
		});
	});
});
