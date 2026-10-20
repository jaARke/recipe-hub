import type {
	RecipeSearch,
	RecipeSearchFacets,
	RecipeSearchQuery,
	RecipeSearchResults,
} from '@/application/ports/recipe-search';

// Facets of a search that found nothing, which a test's own counts start from.
export const noRecipeSearchFacets: RecipeSearchFacets = {
	chapters: {
		'breakfast-brunch': 0,
		'appetizers-beverages': 0,
		'soups-salads': 0,
		'vegetables-sides': 0,
		'main-dishes': 0,
		'breads-rolls': 0,
		desserts: 0,
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
	diets: { vegetarian: 0, vegan: 0, 'gluten-free': 0, 'dairy-free': 0 },
	sources: [],
	contributors: [],
};

// Records the queries it receives, so tests can check what the service asked for.
export class FixedRecipeSearch implements RecipeSearch {
	private readonly results: RecipeSearchResults;
	private readonly queries: RecipeSearchQuery[] = [];

	constructor(results: RecipeSearchResults) {
		this.results = results;
	}

	get receivedQueries(): readonly RecipeSearchQuery[] {
		return this.queries;
	}

	async search(query: RecipeSearchQuery): Promise<RecipeSearchResults> {
		this.queries.push(query);
		return this.results;
	}
}
