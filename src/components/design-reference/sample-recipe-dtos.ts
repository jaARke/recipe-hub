import { savedDraftIdSchema } from '@/application/drafts/saved-draft';
import type { DraftSummaryDto } from '@/application/drafts/saved-draft-dtos';
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
	sampleCremeBrulee,
	sampleOatmealRaisinCookies,
	sampleVanillaRicePudding,
} from '@/domain/recipe/samples/baking-and-desserts';
import {
	sampleButtermilkBiscuits,
	sampleChickenSoup,
	sampleMolassesSpiceCookies,
	sampleRecipeContents,
	sampleSundayPotRoast,
	sampleTomatoSalad,
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

const sampleBiscuits = sampleRecipe(sampleButtermilkBiscuits);

// The biscuits lead the samples and fill in every part of the page but a source link. They borrow the
// other seed photos, so the detail shows its row of thumbnails, the last without a description, and
// two holidays beside their diet.
export const sampleRecipeDetail = toPublicRecipeDto(
	{
		...sampleBiscuits,
		holidays: ['thanksgiving', 'christmas'],
		images: [
			...sampleBiscuits.images,
			...sampleRecipe(sampleChickenSoup).images,
			...sampleRecipe(sampleSundayPotRoast).images,
			...sampleRecipe(sampleTomatoSalad).images.map(({ role, pathname, size }) => ({
				role,
				pathname,
				size,
			})),
		],
	},
	sampleContributor
);

// A search for "butter" among vegetarian recipes added by the sample contributor, counted over its
// four results. Sources and members are every one among the recipes "butter" matches, some at zero,
// and members are counted without their filter, so another member can be chosen.
export const sampleSearchFacets: RecipeSearchFacets = {
	allRecipes: 4,
	chapters: {
		'breakfast-brunch': 0,
		'appetizers-beverages': 0,
		'soups-salads': 0,
		'vegetables-sides': 0,
		'main-dishes': 0,
		'breads-rolls': 1,
		desserts: 0,
		'cookies-candy': 3,
		'this-and-that': 0,
	},
	holidays: {
		'new-years-day': 0,
		'st-patricks-day': 0,
		easter: 0,
		'fourth-of-july': 0,
		halloween: 0,
		thanksgiving: 0,
		christmas: 1,
	},
	diets: { vegetarian: 4, vegan: 0, 'gluten-free': 0, 'dairy-free': 0 },
	totalTimes: { 15: 0, 30: 1, 60: 3, 120: 4 },
	sources: [
		{ label: 'Aunt June', count: 1 },
		{ label: 'Cousin Maya', count: 1 },
		{ label: 'Grandma Rose', count: 0 },
		{ label: 'Grandpa Lou', count: 0 },
		{ label: 'Great-aunt Edie', count: 1 },
		{ label: 'Riverbend Community Cookbook', count: 0 },
		{ label: 'Tante Hélène', count: 0 },
		{ label: 'Uncle Ray', count: 0 },
	],
	contributors: [
		{ ...sampleJordan, count: 0 },
		{ memberId: sampleContributor.id, displayName: sampleContributor.displayName, count: 4 },
		{ ...sampleSam, count: 2 },
	],
};

// Every sample recipe, filed as the samples are.
export const sampleCatalogFacets: RecipeSearchFacets = {
	allRecipes: sampleRecipeContents.length,
	chapters: {
		'breakfast-brunch': 2,
		'appetizers-beverages': 1,
		'soups-salads': 6,
		'vegetables-sides': 2,
		'main-dishes': 6,
		'breads-rolls': 3,
		desserts: 5,
		'cookies-candy': 4,
		'this-and-that': 1,
	},
	holidays: {
		'new-years-day': 0,
		'st-patricks-day': 0,
		easter: 0,
		'fourth-of-july': 0,
		halloween: 0,
		thanksgiving: 0,
		christmas: 2,
	},
	diets: { vegetarian: 21, vegan: 3, 'gluten-free': 6, 'dairy-free': 6 },
	totalTimes: { 15: 2, 30: 5, 60: 17, 120: 24 },
	sources: [
		{ label: 'Aunt June', count: 4 },
		{ label: 'Cousin Maya', count: 3 },
		{ label: 'Grandma Rose', count: 2 },
		{ label: 'Grandpa Lou', count: 3 },
		{ label: 'Great-aunt Edie', count: 2 },
		{ label: 'Riverbend Community Cookbook', count: 3 },
		{ label: 'Tante Hélène', count: 3 },
		{ label: 'Uncle Ray', count: 1 },
	],
	contributors: [
		{ ...sampleJordan, count: 4 },
		{ memberId: sampleContributor.id, displayName: sampleContributor.displayName, count: 18 },
		{ ...sampleSam, count: 8 },
	],
};

// All Recipes' first cards, newest first, counted over every sample recipe.
export const sampleBrowsePage: RecipeSearchPage = {
	results: sampleRecipeContents
		.slice(0, sampleGridCount)
		.map((content) =>
			toRecipeSearchResultDto({ recipe: sampleRecipe(content), title: highlighted(content.title) })
		),
	total: sampleRecipeContents.length,
	match: 'exact',
	facets: sampleCatalogFacets,
};

// A search for "butter" among vegetarian recipes added by the sample contributor, best match first.
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

// Desserts filtered by gluten-free, counted by hand: a salad, a slaw, two main dishes, and two
// desserts are gluten-free, and the two desserts are vegetarian, Tante Hélène's crème brûlée and the
// rice pudding.
export const sampleGlutenFreeDessertsPage: RecipeSearchPage = {
	results: [sampleCremeBrulee, sampleVanillaRicePudding].map((content) =>
		toRecipeSearchResultDto({ recipe: sampleRecipe(content), title: highlighted(content.title) })
	),
	total: 2,
	match: 'exact',
	facets: {
		allRecipes: 6,
		chapters: {
			'breakfast-brunch': 0,
			'appetizers-beverages': 0,
			'soups-salads': 1,
			'vegetables-sides': 1,
			'main-dishes': 2,
			'breads-rolls': 0,
			desserts: 2,
			'cookies-candy': 0,
			'this-and-that': 0,
		},
		holidays: {
			'new-years-day': 0,
			'st-patricks-day': 0,
			easter: 0,
			'fourth-of-july': 0,
			halloween: 0,
			thanksgiving: 0,
			christmas: 0,
		},
		diets: { vegetarian: 2, vegan: 0, 'gluten-free': 2, 'dairy-free': 0 },
		totalTimes: { 15: 0, 30: 0, 60: 1, 120: 1 },
		sources: sampleCatalogFacets.sources.map(({ label }) => ({
			label,
			count: label === 'Tante Hélène' ? 1 : 0,
		})),
		contributors: [
			{ ...sampleJordan, count: 0 },
			{ memberId: sampleContributor.id, displayName: sampleContributor.displayName, count: 2 },
			{ ...sampleSam, count: 0 },
		],
	},
};

// The search for "butter" kept to Cookies & Candy: the three cookies among its four results. Each
// group but the chapters counts within the chapter.
export const sampleChapterSearchPage: RecipeSearchPage = {
	results: sampleSearchPage.results.filter(({ recipe }) => recipe.chapter === 'cookies-candy'),
	total: 3,
	match: 'exact',
	facets: {
		...sampleSearchFacets,
		diets: { vegetarian: 3, vegan: 0, 'gluten-free': 0, 'dairy-free': 0 },
		totalTimes: { 15: 0, 30: 1, 60: 2, 120: 3 },
		sources: sampleSearchFacets.sources.map(({ label }) => ({
			label,
			count: label === 'Cousin Maya' || label === 'Great-aunt Edie' ? 1 : 0,
		})),
		contributors: [
			{ ...sampleJordan, count: 0 },
			{ memberId: sampleContributor.id, displayName: sampleContributor.displayName, count: 3 },
			{ ...sampleSam, count: 1 },
		],
	},
};

// When the drafts list renders, which each sample draft's age counts back from.
export const sampleDraftsNow = new Date('2026-10-12T18:00:00.000Z');

// A member's drafts, newest first: one just read from photos with no title found, one they typed
// this afternoon, one from a link, one from photos two days ago, and one from a link ten days ago.
// Each is deleted a lifetime after its last change.
export const sampleDrafts: readonly DraftSummaryDto[] = [
	{
		id: savedDraftIdSchema.parse('0199d2a0-1b2c-7d3e-8f40-000000000003'),
		mode: 'photo',
		savedAt: new Date('2026-10-12T17:59:30.000Z'),
		expiresAt: new Date('2027-01-10T17:59:30.000Z'),
	},
	{
		id: savedDraftIdSchema.parse('0199d2a0-1b2c-7d3e-8f40-000000000004'),
		title: 'Grandma’s pound cake',
		savedAt: new Date('2026-10-12T16:30:00.000Z'),
		expiresAt: new Date('2027-01-10T16:30:00.000Z'),
	},
	{
		id: savedDraftIdSchema.parse('0199d2a0-1b2c-7d3e-8f40-000000000002'),
		mode: 'url',
		title: 'Sheet-pan gnocchi with sausage and peppers',
		savedAt: new Date('2026-10-12T15:10:00.000Z'),
		expiresAt: new Date('2027-01-10T15:10:00.000Z'),
	},
	{
		id: savedDraftIdSchema.parse('0199d2a0-1b2c-7d3e-8f40-000000000001'),
		mode: 'photo',
		title: 'Lemon bars',
		savedAt: new Date('2026-10-10T12:00:00.000Z'),
		expiresAt: new Date('2027-01-08T12:00:00.000Z'),
	},
	{
		id: savedDraftIdSchema.parse('0199d2a0-1b2c-7d3e-8f40-000000000005'),
		mode: 'url',
		title: 'Buttermilk biscuits',
		savedAt: new Date('2026-10-02T09:15:00.000Z'),
		expiresAt: new Date('2026-12-31T09:15:00.000Z'),
	},
];
