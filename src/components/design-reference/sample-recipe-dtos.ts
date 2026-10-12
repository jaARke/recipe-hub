import type { HighlightedText } from '@/application/ports/recipe-search';
import {
	toPublicRecipeDto,
	toRecipeSummaryDto,
	type RecipeSummaryDto,
} from '@/application/recipes/recipe-dtos';
import {
	toRecipeSearchResultDto,
	type RecipeSearchPage,
} from '@/application/search/recipe-search-dtos';
import { sampleSearchFacets } from '@/components/design-reference/fixtures';
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

// The domain's synthetic samples, shaped by the same mappers as the pages. Never real user data.
// Apart from fixtures.ts, which client components import, because the mappers are server-only.

// Fixed so the reference renders the same every time, with an edit a day after the recipe was added.
const sampleCreatedAt = new Date('2026-10-11T14:00:00.000Z');
const sampleUpdatedAt = new Date('2026-10-12T16:30:00.000Z');

// The DTOs leave out the contributor, so any member id will do.
const sampleContributorId = '3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b';

// The first samples carry the photos and the no-photo box; the rest have no photos.
const sampleGridCount = 6;

// The id follows the sample's place in the list, so a recipe keeps one id across the reference.
function sampleRecipe(content: RecipeContentInput): Recipe {
	const index = sampleRecipeContents.indexOf(content);
	return recipeSchema.parse({
		...content,
		id: `0199c7a4-2c3e-7b1a-9f00-${String(index + 1).padStart(12, '0')}`,
		slug: slugify(content.title),
		contributorId: sampleContributorId,
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
export const sampleRecipeDetail = toPublicRecipeDto(sampleRecipe(sampleButtermilkBiscuits));

// A search for "butter" among baking recipes, best match first.
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
