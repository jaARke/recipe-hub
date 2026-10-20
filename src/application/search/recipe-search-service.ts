import 'server-only';
import { z } from 'zod';
import { paginationSchema } from '@/application/pagination';
import {
	recipeSearchSorts,
	recipeTotalTimeChoices,
	type RecipeSearch,
	type RecipeSearchFacets,
	type RecipeTextQuery,
} from '@/application/ports/recipe-search';
import { InvalidRecipeSearchError } from '@/application/search/errors';
import {
	toRecipeSearchResultDto,
	type RecipeCountsDto,
	type RecipeCountsInput,
	type RecipeSearchInput,
	type RecipeSearchPage,
} from '@/application/search/recipe-search-dtos';
import { parseRecipeTextQuery } from '@/application/search/recipe-text-query';
import { memberIdSchema, type MemberId } from '@/domain/member/member';
import { chapters } from '@/domain/recipe/chapter';
import { dietListSchema } from '@/domain/recipe/diet';
import { holidayListSchema } from '@/domain/recipe/holiday';
import { hasNoNul, plainTextSchema } from '@/domain/text';

// A public URL supplies every value, so the query is bounded, and the holidays and diets are each
// listed once. The source is matched as stored, whatever the recipe limits are now, because the
// filters offer every one recipes use.
const maxTextLength = 200;

const recipeCountsInputSchema = z.object({
	text: z.string().trim().max(maxTextLength).refine(hasNoNul).optional(),
	chapter: z.enum(chapters).optional(),
	holidays: holidayListSchema,
	// With what each diet implies, as recipes hold them.
	diets: dietListSchema,
	source: plainTextSchema.optional(),
	// Lowercased, as Postgres prints ids, so the chosen id matches the contributor facet's.
	contributorId: z.string().trim().toLowerCase().pipe(memberIdSchema).optional(),
	maxTotalMinutes: z.literal(recipeTotalTimeChoices).optional(),
});

const recipeSearchInputSchema = paginationSchema.extend({
	...recipeCountsInputSchema.shape,
	sort: z.enum(recipeSearchSorts),
});

// Search is open to everyone: it never asks for the actor, so pages can call it freely.
export class RecipeSearchService {
	private readonly recipes: RecipeSearch;

	constructor(recipes: RecipeSearch) {
		this.recipes = recipes;
	}

	async searchRecipes(input: RecipeSearchInput): Promise<RecipeSearchPage> {
		const query = this.parseQuery(recipeSearchInputSchema, input);
		const results = await this.recipes.search(query);
		this.requireListedContributor(query.contributorId, results.facets);
		return {
			results: results.hits.map(toRecipeSearchResultDto),
			total: results.total,
			match: results.match,
			facets: results.facets,
		};
	}

	// What searchRecipes would count for the same words and filters, finding no recipe.
	async countRecipes(input: RecipeCountsInput): Promise<RecipeCountsDto> {
		const query = this.parseQuery(recipeCountsInputSchema, input);
		const { total, facets } = await this.recipes.count(query);
		this.requireListedContributor(query.contributorId, facets);
		return { total, counts: facets };
	}

	// The input as the schema normalizes it, with the text read as search syntax.
	private parseQuery<Input extends { text?: string }>(
		schema: z.ZodType<Input>,
		input: unknown
	): Omit<Input, 'text'> & { text?: RecipeTextQuery } {
		const result = schema.safeParse(input);
		if (!result.success) {
			throw new InvalidRecipeSearchError();
		}

		const { text, ...filters } = result.data;
		return { ...filters, text: text === undefined ? undefined : parseRecipeTextQuery(text) };
	}

	// The facet lists the chosen member whenever one exists, so an id it lacks names no member.
	private requireListedContributor(
		contributorId: MemberId | undefined,
		facets: RecipeSearchFacets
	): void {
		if (
			contributorId !== undefined &&
			!facets.contributors.some((contributor) => contributor.memberId === contributorId)
		) {
			throw new InvalidRecipeSearchError();
		}
	}
}
