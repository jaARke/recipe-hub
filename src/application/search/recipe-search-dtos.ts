import 'server-only';
import type {
	HighlightedText,
	RecipeMatch,
	RecipeSearchFacets,
	RecipeSearchHit,
	RecipeSearchSort,
	RecipeTotalTimeChoice,
} from '@/application/ports/recipe-search';
import { toRecipeSummaryDto, type RecipeSummaryDto } from '@/application/recipes/recipe-dtos';
import type { Chapter } from '@/domain/recipe/chapter';
import type { Diet } from '@/domain/recipe/diet';
import type { Holiday } from '@/domain/recipe/holiday';

export type RecipeSearchInput = {
	text?: string;
	chapter?: Chapter;
	holidays: Holiday[];
	diets: Diet[];
	source?: string;
	// A member's id, as the contributor facet lists it.
	contributorId?: string;
	maxTotalMinutes?: RecipeTotalTimeChoice;
	sort: RecipeSearchSort;
	limit: number;
	offset: number;
};

// A search's words and filters, without its order or page, which leave its counts as they are.
export type RecipeCountsInput = Omit<RecipeSearchInput, 'sort' | 'limit' | 'offset'>;

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

// What a search's page would count, before it is shown: its total, and every option's count as its
// facets give it.
export type RecipeCountsDto = {
	total: number;
	counts: RecipeSearchFacets;
};

export function toRecipeSearchResultDto(hit: RecipeSearchHit): RecipeSearchResultDto {
	return {
		recipe: toRecipeSummaryDto(hit.recipe),
		title: hit.title,
		snippet: hit.snippet,
	};
}
