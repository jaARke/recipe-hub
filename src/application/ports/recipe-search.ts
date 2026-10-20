import 'server-only';
import { recipeSorts } from '@/application/ports/recipe-repository';
import type { MemberId } from '@/domain/member/member';
import type { Chapter } from '@/domain/recipe/chapter';
import type { Diet } from '@/domain/recipe/diet';
import type { Holiday } from '@/domain/recipe/holiday';
import type { Recipe } from '@/domain/recipe/recipe';

// Relevance ranks by the text query; without one, results come newest first.
export const recipeSearchSorts = ['relevance', ...recipeSorts] as const;
export type RecipeSearchSort = (typeof recipeSearchSorts)[number];

// The total-time filter's choices, in minutes.
export const recipeTotalTimeChoices = [15, 30, 60, 120] as const;
export type RecipeTotalTimeChoice = (typeof recipeTotalTimeChoices)[number];

export type RecipeTextQuery = {
	// As typed, in web search syntax: "quoted phrases", -exclusions, and or.
	text: string;
	// The words outside exclusions, compared by similarity when nothing matches exactly.
	includedWords: string[];
	// Excluded words and quoted phrases, which close matches leave out too.
	excludedTerms: string[];
};

export type RecipeSearchQuery = {
	text?: RecipeTextQuery;
	chapter?: Chapter;
	// A recipe for any one of them.
	holidays: Holiday[];
	// A recipe that suits every one.
	diets: Diet[];
	// Compared ignoring case.
	source?: string;
	contributorId?: MemberId;
	maxTotalMinutes?: RecipeTotalTimeChoice;
	sort: RecipeSearchSort;
	limit: number;
	offset: number;
};

// What counting takes: a search's words and filters, without its order or page.
export type RecipeCountQuery = Omit<RecipeSearchQuery, 'sort' | 'limit' | 'offset'>;

// Text split into runs, so matches render as marks and recipe text is never treated as markup.
export type HighlightSegment = {
	text: string;
	highlighted: boolean;
};
export type HighlightedText = HighlightSegment[];

export type RecipeSearchHit = {
	recipe: Recipe;
	title: HighlightedText;
	// The passage that matched, or the description when nothing beyond the title or source did.
	snippet?: HighlightedText;
};

export type RecipeFacetCount = {
	label: string;
	count: number;
};

// A choice keyed by the member's id and labeled with their display name.
export type RecipeContributorCount = {
	memberId: MemberId;
	displayName: string;
	count: number;
};

// Each count is what choosing that option would show, so a group counts with every filter but its
// own, within the same match as the results.
export type RecipeSearchFacets = {
	// Counted with every filter but the chapter, as is each chapter: what All Recipes would show.
	allRecipes: number;
	chapters: Record<Chapter, number>;
	// A recipe for any one of them, so each count is what that holiday gives with no other chosen.
	holidays: Record<Holiday, number>;
	// Counted within the results, since a recipe must suit every diet chosen, so each count is what
	// adding that diet would leave.
	diets: Record<Diet, number>;
	// Keyed by each choice's minutes.
	totalTimes: Record<RecipeTotalTimeChoice, number>;
	// Every source among the recipes the words match, even at zero, in order of the source ignoring
	// case, so an option keeps its place as the counts change.
	sources: RecipeFacetCount[];
	// Every member with a recipe the words match, even at zero, in order of name as sources are. The
	// chosen member is listed even with none, because a URL holds only the id and the filters need the
	// name; a chosen id missing here names no member.
	contributors: RecipeContributorCount[];
};

// Chosen from the words alone, before the filters: close matches, which compare words by
// similarity, stand in only when no recipe matches the words exactly.
export type RecipeMatch = 'exact' | 'close';

export type RecipeSearchResults = {
	hits: RecipeSearchHit[];
	total: number;
	match: RecipeMatch;
	facets: RecipeSearchFacets;
};

export type RecipeCounts = {
	total: number;
	facets: RecipeSearchFacets;
};

export interface RecipeSearch {
	search(query: RecipeSearchQuery): Promise<RecipeSearchResults>;
	// The total and facets that search gives for the same words and filters, finding and
	// highlighting no recipe.
	count(query: RecipeCountQuery): Promise<RecipeCounts>;
}
