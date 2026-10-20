import { BackLink } from '@/components/layout/back-link';
import { contributePath } from '@/components/recipe/recipe-paths';
import type { RecipeImportMode } from '@/domain/recipe/recipe-import';

// Each add page's title: the start page's and the imports' are their headings too, while a new
// recipe's and a draft's pages are headed by the recipe's title.
export const recipeEntryTitles = {
	start: 'Add a Recipe',
	url: 'From a Link',
	photo: 'From Photos',
	new: 'New recipe',
	draft: 'Recipe draft',
} as const satisfies Record<'start' | 'new' | 'draft' | RecipeImportMode, string>;

// The back link above every page the start page leads to, which names it.
export const backToStartLabel = `Back to ${recipeEntryTitles.start}`;

// An import's page heading, under the back link to the start page.
function RecipeImportHeading({
	mode,
	headingTag: Heading = 'h1',
}: {
	mode: RecipeImportMode;
	// h4 nests the heading under the design reference's own headings.
	headingTag?: 'h1' | 'h4';
}) {
	return (
		<div className="flex flex-col">
			<BackLink href={contributePath} className="mb-6">
				{backToStartLabel}
			</BackLink>
			<Heading className="font-heading text-4xl font-semibold">{recipeEntryTitles[mode]}</Heading>
		</div>
	);
}

export { RecipeImportHeading };
