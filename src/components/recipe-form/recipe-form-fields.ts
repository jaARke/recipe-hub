import type { Chapter } from '@/domain/recipe/chapter';
import type { Diet } from '@/domain/recipe/diet';
import type { Holiday } from '@/domain/recipe/holiday';
import type { ImageSize, RecipeImageRole } from '@/domain/recipe/recipe-image';
import type { RecipeYield } from '@/domain/recipe/recipe-yield';

// The fields the recipe form submits and its actions read. The recipe travels whole as JSON in one
// field, which recipeContentFromForm reads.
export const recipeFormFieldNames = {
	recipe: 'recipe',
	recipeId: 'recipeId',
	recipeVersion: 'recipeVersion',
	// The form's snapshot as JSON, which saving a draft sends.
	draft: 'draft',
	// The saved draft the form holds, which saving the recipe deletes, and whose provenance and import
	// the recipe takes.
	draftId: 'draftId',
	// The version of that draft the form has, its savedAt, so saving over a newer one is refused, and
	// deleting one, as saving the recipe does, keeps it.
	draftVersion: 'draftVersion',
} as const;

// What saving a draft returns: the draft, which the form then names, and when it was saved, which is
// the version the form then has.
export type SavedDraftResult = {
	draftId: string;
	savedAt: Date;
};

// The recipe a form edits, and the version it loaded, so a save over a newer one is refused.
export type EditedRecipe = {
	id: string;
	version: string;
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
	// Absent until the member chooses one.
	chapter?: Chapter;
	holidays: Holiday[];
	// The diets the member chose; the recipe adds those they imply.
	diets: Diet[];
	// Dish photos in order, the cover first, then scans.
	images: { role: RecipeImageRole; pathname: string; size?: ImageSize; alt?: string }[];
};
