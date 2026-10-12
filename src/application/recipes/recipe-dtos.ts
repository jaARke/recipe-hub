import 'server-only';
import { toPublicMemberDto, type PublicMemberDto } from '@/application/members/member-dtos';
import type { Member } from '@/domain/member/member';
import { totalMinutes } from '@/domain/recipe/duration';
import type { Recipe, RecipeContent, RecipeId } from '@/domain/recipe/recipe';
import { coverImage, dishImages, scanImages, type RecipeImage } from '@/domain/recipe/recipe-image';
import type { RecipeYield } from '@/domain/recipe/recipe-yield';

// What anyone may see: the contributor's public name, no provenance beyond the source URL, and no
// scans.
export type PublicRecipeDto = Omit<RecipeContent, 'images'> & {
	id: RecipeId;
	slug: string;
	contributor: PublicMemberDto;
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

// For the contributor or an admin to edit: the whole content, scans included.
export type EditableRecipeDto = RecipeContent & {
	id: RecipeId;
	slug: string;
	// Changes with every save, so a form can tell its copy is out of date.
	updatedAt: Date;
};

// What a signed-in member sees beside the public recipe: whether they may edit it, and its scans.
export type RecipeMemberViewDto = {
	canEdit: boolean;
	scans: RecipeImage[];
};

// Returned by writes, so callers can redirect to the recipe and invalidate its cache tags.
export type RecipeRef = {
	id: RecipeId;
	slug: string;
};

// The previous slug is set only when the edit moved the slug, so its cache tag is invalidated too.
export type UpdatedRecipeRef = RecipeRef & {
	previousSlug?: string;
};

// What the upload adapter allows the one upload a member was authorized for.
export type ImageUploadGrant = {
	contentType: string;
	maximumSizeInBytes: number;
};

export function toPublicRecipeDto(recipe: Recipe, contributor: Member): PublicRecipeDto {
	return {
		id: recipe.id,
		slug: recipe.slug,
		contributor: toPublicMemberDto(contributor),
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

export function toEditableRecipeDto(recipe: Recipe): EditableRecipeDto {
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
		images: recipe.images,
		updatedAt: recipe.updatedAt,
	};
}

export function toRecipeMemberViewDto(recipe: Recipe, canEdit: boolean): RecipeMemberViewDto {
	return { canEdit, scans: scanImages(recipe.images) };
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
