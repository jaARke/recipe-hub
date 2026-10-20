import { describe, expect, it } from 'vitest';
import type { RecipeSearchFacets } from '@/application/ports/recipe-search';
import { noRecipeSearchFacets } from '@/application/testing/fixed-recipe-search';
import {
	withRecipeFilterCounts,
	type RecipeFilterGroup,
} from '@/components/search/recipe-filter-counts';
import { appliedRecipeFilters, recipeFilterGroups } from '@/components/search/recipe-filter-groups';
import type { RecipeSearchState } from '@/components/search/search-params';
import { memberIdSchema } from '@/domain/member/member';

const adaId = memberIdSchema.parse('0199c7a4-2c3e-7b1a-9f00-2a7c1e4b5d6e');
const barbId = memberIdSchema.parse('7b6f8e64-2d0a-4b9e-9a51-0f6d2c3a8e11');

const allRecipes: RecipeSearchState = { holidays: [], diets: [], sort: 'newest', page: 1 };

const facets: RecipeSearchFacets = {
	...noRecipeSearchFacets,
	holidays: { ...noRecipeSearchFacets.holidays, thanksgiving: 1, christmas: 3 },
	diets: { ...noRecipeSearchFacets.diets, vegetarian: 9 },
	totalTimes: { 15: 2, 30: 5, 60: 18, 120: 25 },
	sources: [
		{ label: 'Aunt June', count: 4 },
		{ label: 'Joy of Cooking', count: 0 },
	],
	contributors: [
		{ memberId: barbId, displayName: 'Barb', count: 30 },
		{ memberId: adaId, displayName: 'Ada', count: 0 },
	],
};

// Each option as the form shows it: its label, its count, and whether it is disabled or folded.
function shown(group: Pick<RecipeFilterGroup, 'options'> | undefined): string[] {
	return (group?.options ?? []).map((option) =>
		[
			option.label,
			option.count === undefined ? undefined : `(${option.count})`,
			option.disabled ? 'disabled' : undefined,
			option.folded ? 'folded' : undefined,
		]
			.filter((part) => part !== undefined)
			.join(' ')
	);
}

function groupIn(
	groups: readonly RecipeFilterGroup[],
	legend: string
): RecipeFilterGroup | undefined {
	return groups.find((group) => group.legend === legend);
}

function filterGroup(
	legend: string,
	state: RecipeSearchState,
	searchFacets = facets
): RecipeFilterGroup | undefined {
	return groupIn(recipeFilterGroups(state, searchFacets).filters, legend);
}

// The groups with a draft's choice in one of them, as the sheet holds them before applying.
function choosing(
	groups: readonly RecipeFilterGroup[],
	legend: string,
	chosen: string[]
): RecipeFilterGroup[] {
	return groups.map((group) => {
		if (group.legend !== legend) {
			return group;
		}

		return group.selection === 'single'
			? { ...group, chosen: chosen[0] ?? group.defaultValue }
			: { ...group, chosen };
	});
}

// Sources named Cook 1, Cook 2, and on, each with a recipe.
function sources(count: number): RecipeSearchFacets['sources'] {
	return Array.from({ length: count }, (_, index) => ({ label: `Cook ${index + 1}`, count: 1 }));
}

describe('recipeFilterGroups', () => {
	it('offers Sort by, then each filter in order, with no group for the chapter', () => {
		const { sort, filters } = recipeFilterGroups({ ...allRecipes, chapter: 'desserts' }, facets);

		expect(
			[sort, ...filters].map(({ legend, field, selection }) => [legend, field, selection])
		).toEqual([
			['Sort by', 'sort', 'single'],
			['Holidays', 'holiday', 'multiple'],
			['Diet', 'diet', 'multiple'],
			['Total time', 'time', 'single'],
			['Recipe from', 'source', 'single'],
			['Added by', 'contributor', 'single'],
		]);
	});

	it.each<[string, RecipeSearchState, string[], string]>([
		['every recipe', allRecipes, ['newest', 'title'], 'newest'],
		[
			'a chapter',
			{ ...allRecipes, chapter: 'desserts', sort: 'title' },
			['newest', 'title'],
			'title',
		],
		[
			'a search',
			{ ...allRecipes, text: 'butter', sort: 'relevance' },
			['relevance', 'newest', 'title'],
			'relevance',
		],
	])('offers %s its orders, leaving its own out of the URL', (_, state, values, defaultValue) => {
		const { sort } = recipeFilterGroups(state, facets);

		expect(sort.options.map((option) => option.value)).toEqual(values);
		expect(sort.defaultValue).toBe(defaultValue);
		expect(sort.chosen).toBe(state.sort);
	});

	it('names the orders without counts', () => {
		const { sort } = recipeFilterGroups({ ...allRecipes, text: 'butter', sort: 'title' }, facets);

		expect(shown(sort)).toEqual(['Best match', 'Newest first', 'A to Z']);
		expect(sort.chosen).toBe('title');
	});

	it('lists every holiday and diet with its count, disabled at zero unless chosen', () => {
		const state: RecipeSearchState = { ...allRecipes, holidays: ['easter'], diets: ['vegan'] };

		expect(shown(filterGroup('Holidays', state))).toEqual([
			'New Year’s Day (0) disabled',
			'St. Patrick’s Day (0) disabled',
			'Easter (0)',
			'Fourth of July (0) disabled',
			'Halloween (0) disabled',
			'Thanksgiving (1)',
			'Christmas (3)',
		]);
		expect(filterGroup('Holidays', state)?.chosen).toEqual(['easter']);
		expect(shown(filterGroup('Diet', state))).toEqual([
			'Vegetarian (9)',
			'Vegan (0)',
			'Gluten-free (0) disabled',
			'Dairy-free (0) disabled',
		]);
		expect(filterGroup('Diet', state)?.chosen).toEqual(['vegan']);
	});

	it('values each holiday and diet by its slug', () => {
		expect(filterGroup('Diet', allRecipes)?.options.map((option) => option.value)).toEqual([
			'vegetarian',
			'vegan',
			'gluten-free',
			'dairy-free',
		]);
	});

	it('leads each one-choice filter with its any choice, which has no count and leaves the URL', () => {
		expect(shown(filterGroup('Total time', allRecipes))).toEqual([
			'Any length',
			'15 minutes or less (2)',
			'30 minutes or less (5)',
			'1 hour or less (18)',
			'2 hours or less (25)',
		]);
		expect(shown(filterGroup('Recipe from', allRecipes))).toEqual([
			'Anyone',
			'Aunt June (4)',
			'Joy of Cooking (0) disabled',
		]);
		expect(shown(filterGroup('Added by', allRecipes))).toEqual([
			'Any member',
			'Barb (30)',
			'Ada (0) disabled',
		]);
		for (const legend of ['Total time', 'Recipe from', 'Added by']) {
			expect(filterGroup(legend, allRecipes)).toMatchObject({ chosen: '', defaultValue: '' });
		}
	});

	it('values each choice as its parameter names it, and chooses what the view applies', () => {
		const state: RecipeSearchState = {
			...allRecipes,
			maxTotalMinutes: 30,
			source: 'Joy of Cooking',
			contributorId: adaId,
		};

		expect(filterGroup('Total time', state)?.options.map((option) => option.value)).toEqual([
			'',
			'15',
			'30',
			'60',
			'120',
		]);
		expect(filterGroup('Total time', state)?.chosen).toBe('30');
		expect(filterGroup('Recipe from', state)?.chosen).toBe('Joy of Cooking');
		expect(shown(filterGroup('Recipe from', state))).toEqual([
			'Anyone',
			'Aunt June (4)',
			'Joy of Cooking (0)',
		]);
		expect(filterGroup('Added by', state)?.options.map((option) => option.value)).toEqual([
			'',
			barbId,
			adaId,
		]);
		expect(filterGroup('Added by', state)?.chosen).toBe(adaId);
		expect(shown(filterGroup('Added by', state))).toEqual(['Any member', 'Barb (30)', 'Ada (0)']);
	});

	it('keeps the facets’ order of sources and members', () => {
		const reordered: RecipeSearchFacets = {
			...facets,
			sources: [...facets.sources].reverse(),
			contributors: [...facets.contributors].reverse(),
		};

		expect(shown(filterGroup('Recipe from', allRecipes, reordered))).toEqual([
			'Anyone',
			'Joy of Cooking (0) disabled',
			'Aunt June (4)',
		]);
		expect(shown(filterGroup('Added by', allRecipes, reordered))).toEqual([
			'Any member',
			'Ada (0) disabled',
			'Barb (30)',
		]);
	});

	it('folds Recipe from after its first six options, Anyone among them', () => {
		expect(
			shown(filterGroup('Recipe from', allRecipes, { ...facets, sources: sources(10) }))
		).toEqual([
			'Anyone',
			'Cook 1 (1)',
			'Cook 2 (1)',
			'Cook 3 (1)',
			'Cook 4 (1)',
			'Cook 5 (1)',
			'Cook 6 (1) folded',
			'Cook 7 (1) folded',
			'Cook 8 (1) folded',
			'Cook 9 (1) folded',
			'Cook 10 (1) folded',
		]);
	});

	it.each([
		[6, 0],
		[7, 2],
	])(
		'folds Recipe from only where two or more would fold: of %i sources, %i',
		(sourceCount, foldCount) => {
			const group = filterGroup('Recipe from', allRecipes, {
				...facets,
				sources: sources(sourceCount),
			});

			expect(group?.options.filter((option) => option.folded)).toHaveLength(foldCount);
		}
	);

	it('keeps a chosen source in its place in the fold', () => {
		const group = filterGroup(
			'Recipe from',
			{ ...allRecipes, source: 'Cook 8' },
			{ ...facets, sources: sources(10) }
		);

		expect(group?.chosen).toBe('Cook 8');
		expect(group?.options[8]).toMatchObject({ value: 'Cook 8', folded: true, disabled: false });
	});

	it('chooses a source as recipes spell it', () => {
		const group = filterGroup('Recipe from', { ...allRecipes, source: 'aunt JUNE' });

		expect(group?.chosen).toBe('Aunt June');
		expect(shown(group)).toEqual(['Anyone', 'Aunt June (4)', 'Joy of Cooking (0) disabled']);
	});

	it('lists a chosen source no recipe has last, at zero, so it can be cleared', () => {
		const group = filterGroup('Recipe from', { ...allRecipes, source: 'Grandma Rose' });

		expect(group?.chosen).toBe('Grandma Rose');
		expect(shown(group)).toEqual([
			'Anyone',
			'Aunt June (4)',
			'Joy of Cooking (0) disabled',
			'Grandma Rose (0)',
		]);
	});
});

describe('appliedRecipeFilters', () => {
	it('names each filter as its option does, in Filter and sort’s order, each removed from the first page', () => {
		const state: RecipeSearchState = {
			chapter: 'desserts',
			holidays: ['thanksgiving', 'christmas'],
			diets: ['vegetarian'],
			source: 'Aunt June',
			contributorId: barbId,
			maxTotalMinutes: 60,
			sort: 'title',
			page: 2,
		};

		expect(appliedRecipeFilters(state, facets)).toEqual([
			{
				key: 'holiday-thanksgiving',
				label: 'Thanksgiving',
				href: `/?chapter=desserts&holiday=christmas&diet=vegetarian&time=60&source=Aunt+June&contributor=${barbId}`,
			},
			{
				key: 'holiday-christmas',
				label: 'Christmas',
				href: `/?chapter=desserts&holiday=thanksgiving&diet=vegetarian&time=60&source=Aunt+June&contributor=${barbId}`,
			},
			{
				key: 'diet-vegetarian',
				label: 'Vegetarian',
				href: `/?chapter=desserts&holiday=thanksgiving&holiday=christmas&time=60&source=Aunt+June&contributor=${barbId}`,
			},
			{
				key: 'time',
				label: '1 hour or less',
				href: `/?chapter=desserts&holiday=thanksgiving&holiday=christmas&diet=vegetarian&source=Aunt+June&contributor=${barbId}`,
			},
			{
				key: 'source',
				label: 'From Aunt June',
				href: `/?chapter=desserts&holiday=thanksgiving&holiday=christmas&diet=vegetarian&time=60&contributor=${barbId}`,
			},
			{
				key: 'contributor',
				label: 'Added by Barb',
				href: '/?chapter=desserts&holiday=thanksgiving&holiday=christmas&diet=vegetarian&time=60&source=Aunt+June',
			},
		]);
	});

	it('names a source as recipes spell it', () => {
		expect(appliedRecipeFilters({ ...allRecipes, source: 'joy of cooking' }, facets)).toEqual([
			{ key: 'source', label: 'From Joy of Cooking', href: '/' },
		]);
	});

	it('names no filter for the words or the chapter, which are the view', () => {
		expect(
			appliedRecipeFilters(
				{ ...allRecipes, text: 'pie', chapter: 'desserts', sort: 'title' },
				facets
			)
		).toEqual([]);
	});
});

describe('withRecipeFilterCounts', () => {
	it('recounts each option from the counts fetched, keeping its place and its fold', () => {
		const { filters } = recipeFilterGroups(allRecipes, { ...facets, sources: sources(8) });
		const fetched: RecipeSearchFacets = {
			...noRecipeSearchFacets,
			holidays: { ...noRecipeSearchFacets.holidays, christmas: 1 },
			diets: { ...noRecipeSearchFacets.diets, vegetarian: 2 },
			totalTimes: { 15: 0, 30: 1, 60: 2, 120: 2 },
			sources: [{ label: 'Cook 7', count: 2 }],
			contributors: [{ memberId: barbId, displayName: 'Barb', count: 2 }],
		};

		const counted = withRecipeFilterCounts(filters, fetched);

		expect(shown(groupIn(counted, 'Holidays'))).toEqual([
			'New Year’s Day (0) disabled',
			'St. Patrick’s Day (0) disabled',
			'Easter (0) disabled',
			'Fourth of July (0) disabled',
			'Halloween (0) disabled',
			'Thanksgiving (0) disabled',
			'Christmas (1)',
		]);
		expect(shown(groupIn(counted, 'Diet'))).toEqual([
			'Vegetarian (2)',
			'Vegan (0) disabled',
			'Gluten-free (0) disabled',
			'Dairy-free (0) disabled',
		]);
		expect(shown(groupIn(counted, 'Total time'))).toEqual([
			'Any length',
			'15 minutes or less (0) disabled',
			'30 minutes or less (1)',
			'1 hour or less (2)',
			'2 hours or less (2)',
		]);
		expect(shown(groupIn(counted, 'Recipe from'))).toEqual([
			'Anyone',
			'Cook 1 (0) disabled',
			'Cook 2 (0) disabled',
			'Cook 3 (0) disabled',
			'Cook 4 (0) disabled',
			'Cook 5 (0) disabled',
			'Cook 6 (0) disabled folded',
			'Cook 7 (2) folded',
			'Cook 8 (0) disabled folded',
		]);
		expect(shown(groupIn(counted, 'Added by'))).toEqual([
			'Any member',
			'Barb (2)',
			'Ada (0) disabled',
		]);
	});

	it('disables an option at zero unless the draft chooses it', () => {
		const { filters } = recipeFilterGroups(
			{ ...allRecipes, holidays: ['christmas'] },
			{ ...facets, holidays: { ...facets.holidays, easter: 2 } }
		);
		const draft = choosing(choosing(filters, 'Holidays', ['easter']), 'Total time', ['15']);

		const counted = withRecipeFilterCounts(draft, noRecipeSearchFacets);

		expect(shown(groupIn(counted, 'Holidays'))).toEqual([
			'New Year’s Day (0) disabled',
			'St. Patrick’s Day (0) disabled',
			'Easter (0)',
			'Fourth of July (0) disabled',
			'Halloween (0) disabled',
			'Thanksgiving (0) disabled',
			'Christmas (0) disabled',
		]);
		expect(shown(groupIn(counted, 'Total time'))).toEqual([
			'Any length',
			'15 minutes or less (0)',
			'30 minutes or less (0) disabled',
			'1 hour or less (0) disabled',
			'2 hours or less (0) disabled',
		]);
	});

	it('finds sources ignoring case and members by id, at zero where the counts lack them', () => {
		const { filters } = recipeFilterGroups({ ...allRecipes, source: 'Grandma Rose' }, facets);
		const draft = choosing(filters, 'Recipe from', ['Aunt June']);
		const fetched: RecipeSearchFacets = {
			...noRecipeSearchFacets,
			sources: [{ label: 'AUNT JUNE', count: 3 }],
			contributors: [{ memberId: adaId, displayName: 'Ada', count: 1 }],
		};

		const counted = withRecipeFilterCounts(draft, fetched);

		expect(shown(groupIn(counted, 'Recipe from'))).toEqual([
			'Anyone',
			'Aunt June (3)',
			'Joy of Cooking (0) disabled',
			'Grandma Rose (0) disabled',
		]);
		expect(shown(groupIn(counted, 'Added by'))).toEqual([
			'Any member',
			'Barb (0) disabled',
			'Ada (1)',
		]);
	});
});
