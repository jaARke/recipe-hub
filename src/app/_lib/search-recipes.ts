import 'server-only';
import { InvalidRecipeSearchError } from '@/application/search/errors';
import type { RecipeSearchInput, RecipeSearchPage } from '@/application/search/recipe-search-dtos';
import { getRecipeSearchService } from '@/composition/services';

// Null for input the service refuses, such as an overlong query, which is a bad URL like any other.
// A value rather than the error, so a cached read can keep it: a cache returns an error's message
// and not its class.
export async function searchRecipes(input: RecipeSearchInput): Promise<RecipeSearchPage | null> {
	try {
		return await getRecipeSearchService().searchRecipes(input);
	} catch (error) {
		if (error instanceof InvalidRecipeSearchError) {
			return null;
		}
		throw error;
	}
}
