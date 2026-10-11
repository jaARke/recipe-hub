import 'server-only';
import { totalMinutes } from '@/domain/recipe/duration';
import type { Recipe, RecipeContent, RecipeId } from '@/domain/recipe/recipe';
import { coverImage, dishImages, type RecipeImage } from '@/domain/recipe/recipe-image';
import type { RecipeYield } from '@/domain/recipe/recipe-yield';

// What anyone may see: no contributor, no provenance beyond the source URL, and no scans.
export type PublicRecipeDto = Omit<RecipeContent, 'images'> & {
	id: RecipeId;
	slug: string;
	// Dish photos only; scans are for members.
	images: RecipeImage[];
	sourceUrl?: string;
	createdAt: Date;
	updatedAt: Date;
};

export type RecipeSummaryDto = {
	id: RecipeId;
	slug: string;
	title: string;
	source?: string;
	totalMinutes?: number;
	yield?: RecipeYield;
	tags: string[];
	coverImage?: RecipeImage;
	createdAt: Date;
};

// One page of the list, with the count of every recipe so the list can number its pages.
export type RecipeSummaryPage = {
	recipes: RecipeSummaryDto[];
	total: number;
};

// Returned by writes, so callers can redirect to the recipe and invalidate its cache tags.
export type RecipeRef = {
	id: RecipeId;
	slug: string;
};

export function toPublicRecipeDto(recipe: Recipe): PublicRecipeDto {
	return {
		id: recipe.id,
		slug: recipe.slug,
		title: recipe.title,
		description: recipe.description,
		notes: recipe.notes,
		source: recipe.source,
		yield: recipe.yield,
		times: recipe.times,
		ingredientSections: recipe.ingredientSections,
		instructionSections: recipe.instructionSections,
		tags: recipe.tags,
		images: dishImages(recipe.images),
		sourceUrl: recipe.provenance.entryMode === 'url' ? recipe.provenance.sourceUrl : undefined,
		createdAt: recipe.createdAt,
		updatedAt: recipe.updatedAt,
	};
}

export function toRecipeSummaryDto(recipe: Recipe): RecipeSummaryDto {
	return {
		id: recipe.id,
		slug: recipe.slug,
		title: recipe.title,
		source: recipe.source,
		totalMinutes: totalMinutes(recipe.times),
		yield: recipe.yield,
		tags: recipe.tags,
		coverImage: coverImage(recipe.images),
		createdAt: recipe.createdAt,
	};
}

export function toRecipeRef(recipe: Recipe): RecipeRef {
	return { id: recipe.id, slug: recipe.slug };
}
