import type { HighlightedText, RecipeSearchFacets } from '@/application/ports/recipe-search';
import {
	toPublicRecipeDto,
	toRecipeSummaryDto,
	type RecipeSummaryDto,
} from '@/application/recipes/recipe-dtos';
import {
	toRecipeSearchResultDto,
	type RecipeSearchPage,
} from '@/application/search/recipe-search-dtos';
import { memberIdSchema, memberSchema } from '@/domain/member/member';
import { recipeSchema, type Recipe, type RecipeContentInput } from '@/domain/recipe/recipe';
import {
	sampleBrownButterChocolateChipCookies,
	sampleOatmealRaisinCookies,
} from '@/domain/recipe/samples/baking-and-desserts';
import {
	sampleButtermilkBiscuits,
	sampleMolassesSpiceCookies,
	sampleRecipeContents,
} from '@/domain/recipe/samples/sample-recipes';
import { slugify } from '@/domain/recipe/slug';

// The domain's synthetic samples, shaped by the same mappers as the pages, and search facets that
// name sample members. Never real user data. Apart from fixtures.ts, which client components
// import, because the mappers are server-only and member ids need the domain's schema.

// Fixed so the reference renders the same every time, with an edit a day after the recipe was added.
const sampleCreatedAt = new Date('2026-10-11T14:00:00.000Z');
const sampleUpdatedAt = new Date('2026-10-12T16:30:00.000Z');

// Adds every sample; pages show only the display name.
export const sampleContributor = memberSchema.parse({
	id: '3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b',
	displayName: 'Robin',
	email: 'robin@example.com',
	role: 'member',
	createdAt: sampleCreatedAt,
});

// Other members, who appear in the search facets and the admin page's member list.
export const sampleSam = {
	memberId: memberIdSchema.parse('5a1d9e2f-7b3c-4d8e-8f6a-2b3c4d5e6f7a'),
	displayName: 'Sam',
};
export const sampleJordan = {
	memberId: memberIdSchema.parse('7c4e1a3b-9d2f-4a6e-b8c1-3d4e5f6a7b8c'),
	displayName: 'Jordan',
};

// The first samples carry the photos and the no-photo box; the rest have no photos.
const sampleGridCount = 6;

// The id follows the sample's place in the list, so a recipe keeps one id across the reference.
function sampleRecipe(content: RecipeContentInput): Recipe {
	const index = sampleRecipeContents.indexOf(content);
	return recipeSchema.parse({
		...content,
		id: `0199c7a4-2c3e-7b1a-9f00-${String(index + 1).padStart(12, '0')}`,
		slug: slugify(content.title),
		contributorId: sampleContributor.id,
		provenance: { entryMode: 'manual' },
		createdAt: sampleCreatedAt,
		updatedAt: sampleUpdatedAt,
	});
}

// Marks a match as [text], the way search highlights its matches.
function highlighted(text: string): HighlightedText {
	return text
		.split(/(\[[^\]]*\])/)
		.filter((part) => part !== '')
		.map((part) =>
			part.startsWith('[')
				? { text: part.slice(1, -1), highlighted: true }
				: { text: part, highlighted: false }
		);
}

export const sampleRecipeSummaries: readonly RecipeSummaryDto[] = sampleRecipeContents
	.slice(0, sampleGridCount)
	.map((content) => toRecipeSummaryDto(sampleRecipe(content)));

// The biscuits lead the samples and fill in every part of the page but a source link.
export const sampleRecipeDetail = toPublicRecipeDto(
	sampleRecipe(sampleButtermilkBiscuits),
	sampleContributor
);

// A search for "butter" among baking recipes added by the sample contributor, counted over its four
// results. Contributors are counted without that filter, so another member can be chosen.
export const sampleSearchFacets: RecipeSearchFacets = {
	tags: [
		{ label: 'Baking', count: 4 },
		{ label: 'Dessert', count: 2 },
		{ label: 'Freezer friendly', count: 2 },
		{ label: 'Breakfast', count: 1 },
		{ label: 'Holiday', count: 1 },
	],
	sources: [
		{ label: 'Aunt June', count: 1 },
		{ label: 'Cousin Maya', count: 1 },
		{ label: 'Great-aunt Edie', count: 1 },
	],
	contributors: [
		{ memberId: sampleContributor.id, displayName: sampleContributor.displayName, count: 4 },
		{ ...sampleSam, count: 2 },
	],
};

// Every sample recipe, with more tags than the filters show before folding the rest away.
export const sampleCatalogFacets: RecipeSearchFacets = {
	tags: [
		{ label: 'Baking', count: 10 },
		{ label: 'Vegetarian', count: 9 },
		{ label: 'Dessert', count: 8 },
		{ label: 'Make ahead', count: 6 },
		{ label: 'Dinner', count: 5 },
		{ label: 'Soup', count: 5 },
		{ label: 'Breakfast', count: 4 },
		{ label: 'Summer', count: 4 },
		{ label: 'Freezer friendly', count: 3 },
		{ label: 'Holiday', count: 3 },
		{ label: 'Weeknight', count: 3 },
		{ label: 'Français', count: 2 },
		{ label: 'Main', count: 2 },
		{ label: 'Salad', count: 2 },
		{ label: 'Appetizer', count: 1 },
		{ label: 'Comfort food', count: 1 },
		{ label: 'Side', count: 1 },
		{ label: 'Slow cooked', count: 1 },
	],
	sources: [
		{ label: 'Aunt June', count: 4 },
		{ label: 'Cousin Maya', count: 3 },
		{ label: 'Grandpa Lou', count: 3 },
		{ label: 'Riverbend Community Cookbook', count: 3 },
		{ label: 'Tante Hélène', count: 3 },
		{ label: 'Grandma Rose', count: 2 },
		{ label: 'Great-aunt Edie', count: 2 },
		{ label: 'Uncle Ray', count: 1 },
	],
	contributors: [
		{ memberId: sampleContributor.id, displayName: sampleContributor.displayName, count: 18 },
		{ ...sampleSam, count: 8 },
		{ ...sampleJordan, count: 4 },
	],
};

// A search for "butter" among baking recipes added by the sample contributor, best match first.
export const sampleSearchPage: RecipeSearchPage = {
	results: [
		toRecipeSearchResultDto({
			recipe: sampleRecipe(sampleBrownButterChocolateChipCookies),
			title: highlighted('Chocolate chip cookies with brown [butter]'),
			snippet: highlighted(
				'Brown [butter] gives these cookies a toasty, nutty flavor, and chopped chocolate melts into puddles.'
			),
		}),
		toRecipeSearchResultDto({
			recipe: sampleRecipe(sampleButtermilkBiscuits),
			title: highlighted('Buttermilk biscuits'),
			snippet: highlighted(
				'Tall, flaky biscuits that June baked every Sunday morning. Cold [butter] and a gentle hand do most of the work.'
			),
		}),
		toRecipeSearchResultDto({
			recipe: sampleRecipe(sampleMolassesSpiceCookies),
			title: highlighted('Molasses spice cookies'),
			snippet: highlighted('¾ cup unsalted [butter], softened'),
		}),
		toRecipeSearchResultDto({
			recipe: sampleRecipe(sampleOatmealRaisinCookies),
			title: highlighted('Oatmeal raisin cookies'),
			snippet: highlighted('1 cup [butter], softened'),
		}),
	],
	total: 4,
	match: 'exact',
	facets: sampleSearchFacets,
};
