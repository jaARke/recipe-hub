import 'server-only';
import type {
	HighlightedText,
	RecipeAddedWithin,
	RecipeMatch,
	RecipeSearchFacets,
	RecipeSearchHit,
	RecipeSearchSort,
} from '@/application/ports/recipe-search';
import { toRecipeSummaryDto, type RecipeSummaryDto } from '@/application/recipes/recipe-dtos';

// The total-time filter's choices, in minutes.
export const recipeTotalTimeChoices = [15, 30, 60, 120] as const;
export type RecipeTotalTimeChoice = (typeof recipeTotalTimeChoices)[number];

export type RecipeSearchInput = {
	text?: string;
	tags: string[];
	source?: string;
	// A member's id, as the contributor facet lists it.
	contributorId?: string;
	maxTotalMinutes?: RecipeTotalTimeChoice;
	addedWithin?: RecipeAddedWithin;
	sort: RecipeSearchSort;
	limit: number;
	offset: number;
};

export type RecipeSearchResultDto = {
	recipe: RecipeSummaryDto;
	title: HighlightedText;
	snippet?: HighlightedText;
};

// One page of results, with the count of every result so the page can number its pages.
export type RecipeSearchPage = {
	results: RecipeSearchResultDto[];
	total: number;
	match: RecipeMatch;
	facets: RecipeSearchFacets;
};

export function toRecipeSearchResultDto(hit: RecipeSearchHit): RecipeSearchResultDto {
	return {
		recipe: toRecipeSummaryDto(hit.recipe),
		title: hit.title,
		snippet: hit.snippet,
	};
}
