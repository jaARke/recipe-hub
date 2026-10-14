import 'server-only';
import { z } from 'zod';
import { paginationSchema } from '@/application/pagination';
import {
	recipeAddedWithin,
	recipeSearchSorts,
	type RecipeSearch,
} from '@/application/ports/recipe-search';
import { InvalidRecipeSearchError } from '@/application/search/errors';
import {
	recipeTotalTimeChoices,
	toRecipeSearchResultDto,
	type RecipeSearchInput,
	type RecipeSearchPage,
} from '@/application/search/recipe-search-dtos';
import { parseRecipeTextQuery } from '@/application/search/recipe-text-query';
import { memberIdSchema } from '@/domain/member/member';
import { storedTagListSchema } from '@/domain/recipe/tag';
import { hasNoNul, nonEmptyTextSchema } from '@/domain/text';

// A public URL supplies every value, so the query and the tag list are bounded. Tags and the source
// are matched as stored, whatever the recipe limits are now, because the filters offer every one
// recipes use.
const maxTextLength = 200;
const maxTagCount = 20;

const recipeSearchInputSchema = paginationSchema.extend({
	text: z.string().trim().max(maxTextLength).refine(hasNoNul).optional(),
	tags: storedTagListSchema.max(maxTagCount),
	source: nonEmptyTextSchema.optional(),
	// Lowercased, as Postgres prints ids, so the chosen id matches the contributor facet's.
	contributorId: z.string().trim().toLowerCase().pipe(memberIdSchema).optional(),
	maxTotalMinutes: z.literal(recipeTotalTimeChoices).optional(),
	addedWithin: z.enum(recipeAddedWithin).optional(),
	sort: z.enum(recipeSearchSorts),
});

// Search is open to everyone: it never asks for the actor, so pages can call it freely.
export class RecipeSearchService {
	private readonly recipes: RecipeSearch;

	constructor(recipes: RecipeSearch) {
		this.recipes = recipes;
	}

	async searchRecipes(input: RecipeSearchInput): Promise<RecipeSearchPage> {
		const result = recipeSearchInputSchema.safeParse(input);
		if (!result.success) {
			throw new InvalidRecipeSearchError();
		}

		const { text, ...filters } = result.data;
		const results = await this.recipes.search({
			...filters,
			text: text === undefined ? undefined : parseRecipeTextQuery(text),
		});
		// The facet lists the chosen member whenever one exists, so an id it lacks names no member.
		const { contributorId } = filters;
		if (
			contributorId !== undefined &&
			!results.facets.contributors.some((contributor) => contributor.memberId === contributorId)
		) {
			throw new InvalidRecipeSearchError();
		}

		return {
			results: results.hits.map(toRecipeSearchResultDto),
			total: results.total,
			match: results.match,
			facets: results.facets,
		};
	}
}
