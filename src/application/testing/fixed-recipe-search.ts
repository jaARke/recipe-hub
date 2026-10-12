import type {
	RecipeSearch,
	RecipeSearchQuery,
	RecipeSearchResults,
} from '@/application/ports/recipe-search';

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
