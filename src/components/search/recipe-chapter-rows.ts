import type { RecipeSearchFacets } from '@/application/ports/recipe-search';
import type { RecipeChapterRow } from '@/components/search/recipe-chapters';
import {
	recipeSearchHref,
	recipesViewName,
	withChapter,
	withoutChapter,
	type RecipeSearchState,
} from '@/components/search/search-params';
import { chapters } from '@/domain/recipe/chapter';

// The chapter list, built on the server since URLs are: All Recipes, then the chapters in the
// cookbook's order, each named as its view's heading and linking to it with the words and filters.
export function recipeChapterRows(
	state: RecipeSearchState,
	facets: Pick<RecipeSearchFacets, 'allRecipes' | 'chapters'>
): RecipeChapterRow[] {
	const row = (view: RecipeSearchState, count: number): RecipeChapterRow => ({
		label: recipesViewName(view).heading,
		href: recipeSearchHref(view),
		count,
		current: view.chapter === state.chapter,
	});

	return [
		row(withoutChapter(state), facets.allRecipes),
		...chapters.map((chapter) => row(withChapter(state, chapter), facets.chapters[chapter])),
	];
}
