import type { RecipeImageRole } from '@/domain/recipe/recipe-image';
import type { RecipeYield } from '@/domain/recipe/recipe-yield';

// The fields the recipe form submits and its actions read. The recipe travels whole as JSON in one
// field, which recipeContentFromForm reads.
export const recipeFormFieldNames = {
	recipe: 'recipe',
	recipeId: 'recipeId',
	recipeVersion: 'recipeVersion',
	// The import a create form reviews, whose provenance the saved recipe takes.
	importId: 'importId',
} as const;

// The recipe a form edits, and the version it loaded, so a save over a newer one is refused.
export type EditedRecipe = {
	id: string;
	version: string;
	// Its tags that no other recipe uses, which the tags field offers to respell.
	respellableTags: readonly string[];
};

// The recipe as the form sends it: text as typed, without blank items or blank optional text. Its
// paths match the recipe content's, so a problem the domain finds names the item that caused it.
export type RecipeFormPayload = {
	title: string;
	description?: string;
	source?: string;
	notes?: string;
	yield?: {
		kind: RecipeYield['kind'];
		amount: string;
		unit?: string;
	};
	times: {
		prepMinutes?: string;
		cookMinutes?: string;
		totalMinutes?: string;
	};
	ingredientSections: { heading?: string; lines: string[] }[];
	instructionSections: { heading?: string; steps: string[] }[];
	tags: string[];
	// Dish photos in order, the cover first, then scans.
	images: { role: RecipeImageRole; pathname: string; alt?: string }[];
};
