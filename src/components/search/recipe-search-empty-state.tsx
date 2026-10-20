import { TextLink } from '@/components/layout/text-link';
import { allRecipesTitle } from '@/components/recipe/recipe-paths';
import { RecipesEmptyState } from '@/components/recipe/recipes-empty-state';
import {
	appliedFilterCount,
	recipeSearchHref,
	withoutChapter,
	withoutFilters,
	withoutText,
	type RecipeSearchState,
} from '@/components/search/search-params';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader } from '@/components/ui/empty';
import { chapterLabels } from '@/domain/recipe/chapter';

type WayOut = { label: string; href: string };

// Why the view found nothing. Words that match no recipe exactly fall back to close matches, so
// "match" covers both: a search whose close matches the filters or chapter leave out finds none too.
function emptyMessage(state: RecipeSearchState, hasFilters: boolean): string {
	const within = state.chapter === undefined ? '' : ` in ${chapterLabels[state.chapter]}`;
	if (state.text !== undefined) {
		return `No recipes${within} match “${state.text}”${hasFilters ? ' with these filters' : ''}.`;
	}

	return hasFilters ? `No recipes${within} match these filters.` : `No recipes${within} yet.`;
}

// Says why the view shows nothing, and offers its ways out: the search cleared, the filters cleared,
// and in a chapter, the words searched for in every recipe. Its message sits in the middle of the box,
// alone where there is no way out, as in a chapter no one has filed a recipe in. A cookbook with no
// recipes at all shows the recipes' empty state.
function RecipeSearchEmptyState({ state }: { state: RecipeSearchState }) {
	const hasFilters = appliedFilterCount(state) > 0;
	if (state.text === undefined && state.chapter === undefined && !hasFilters) {
		return <RecipesEmptyState />;
	}

	const waysOut: WayOut[] = [];
	if (state.text !== undefined) {
		waysOut.push({ label: 'Clear search', href: recipeSearchHref(withoutText(state)) });
	}
	if (hasFilters) {
		waysOut.push({ label: 'Clear filters', href: recipeSearchHref(withoutFilters(state)) });
	}
	if (state.text !== undefined && state.chapter !== undefined) {
		waysOut.push({
			label: `Search ${allRecipesTitle} for “${state.text}”`,
			href: recipeSearchHref(withoutChapter(state)),
		});
	}

	return (
		<Empty className="border p-8">
			<EmptyHeader>
				<EmptyDescription>{emptyMessage(state, hasFilters)}</EmptyDescription>
			</EmptyHeader>
			{waysOut.length > 0 && (
				<EmptyContent className="flex-row flex-wrap justify-center gap-x-6 gap-y-2">
					{waysOut.map(({ label, href }) => (
						// As tall as a tap target must be.
						<TextLink key={label} href={href} className="inline-flex min-h-6 items-center">
							{label}
						</TextLink>
					))}
				</EmptyContent>
			)}
		</Empty>
	);
}

export { RecipeSearchEmptyState };
