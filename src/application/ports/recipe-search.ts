import 'server-only';
import { recipeSorts } from '@/application/ports/recipe-repository';
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
	// Normalized labels, compared by tag key; a recipe must carry every one.
	tags: string[];
	// Compared ignoring case.
	source?: string;
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

export type RecipeSearchFacets = {
	// Counted within the results, so each count is what adding that tag would leave.
	tags: RecipeFacetCount[];
	// Counted with every filter but the source, so the count shows what choosing it would give.
	sources: RecipeFacetCount[];
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
