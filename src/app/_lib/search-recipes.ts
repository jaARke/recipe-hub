import 'server-only';
import { InvalidRecipeSearchError } from '@/application/search/errors';
import type {
	RecipeCountsDto,
	RecipeCountsInput,
	RecipeSearchInput,
	RecipeSearchPage,
} from '@/application/search/recipe-search-dtos';
import { getRecipeSearchService } from '@/composition/services';

// Null for input the service refuses, such as an overlong query, which is a bad URL like any other.
// A value rather than the error, so a cached read can keep it: a cache returns an error's message
// and not its class.
async function nullWhenRefused<Value>(read: () => Promise<Value>): Promise<Value | null> {
	try {
		return await read();
	} catch (error) {
		if (error instanceof InvalidRecipeSearchError) {
			return null;
		}
		throw error;
	}
}

export async function searchRecipes(input: RecipeSearchInput): Promise<RecipeSearchPage | null> {
	return nullWhenRefused(() => getRecipeSearchService().searchRecipes(input));
}

export async function countRecipes(input: RecipeCountsInput): Promise<RecipeCountsDto | null> {
	return nullWhenRefused(() => getRecipeSearchService().countRecipes(input));
}
