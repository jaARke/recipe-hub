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

// Rolling windows back from now.
export const recipeAddedWithin = ['week', 'month', 'year'] as const;
export type RecipeAddedWithin = (typeof recipeAddedWithin)[number];

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
	maxTotalMinutes?: number;
	addedWithin?: RecipeAddedWithin;
	sort: RecipeSearchSort;
	limit: number;
	offset: number;
};

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

export type RecipeSearchFacets = {
	// Counted with every filter but the chapter, so each count is what choosing that chapter would give.
	chapters: Record<Chapter, number>;
	// Counted with every filter but the holidays, so each count is what that holiday alone would give.
	holidays: Record<Holiday, number>;
	// Counted within the results, since a recipe must suit every diet chosen, so each count is what
	// adding that diet would leave.
	diets: Record<Diet, number>;
	// Counted with every filter but the source, so the count shows what choosing it would give.
	sources: RecipeFacetCount[];
	// Counted like sources. The chosen member is listed even at zero, because a URL holds only
	// the id and the filters need the name; a chosen id missing here names no member.
	contributors: RecipeContributorCount[];
};

// Close matches compare words by similarity and are returned only when nothing matches exactly.
export type RecipeMatch = 'exact' | 'close';

export type RecipeSearchResults = {
	hits: RecipeSearchHit[];
	total: number;
	match: RecipeMatch;
	facets: RecipeSearchFacets;
};

export interface RecipeSearch {
	search(query: RecipeSearchQuery): Promise<RecipeSearchResults>;
}
