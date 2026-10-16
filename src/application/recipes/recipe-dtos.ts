import 'server-only';
import { toPublicMemberDto, type PublicMemberDto } from '@/application/members/member-dtos';
import type { Member } from '@/domain/member/member';
import { totalMinutes } from '@/domain/recipe/duration';
import { sourceUrlSchema } from '@/domain/recipe/provenance';
import type { Recipe, RecipeContent, RecipeId } from '@/domain/recipe/recipe';
import { coverImage, dishImages, scanImages, type RecipeImage } from '@/domain/recipe/recipe-image';
import type { RecipeYield } from '@/domain/recipe/recipe-yield';

// What anyone may see: the contributor's public name and no provenance beyond the source URL.
export type PublicRecipeDto = Omit<RecipeContent, 'images'> & {
	id: RecipeId;
	slug: string;
	contributor: PublicMemberDto;
	// Dish photos only, so a cover, a share card, or JSON-LD can never show a scan.
	images: RecipeImage[];
	// The pages of the recipe as first written, shown in a section of their own.
	scans: RecipeImage[];
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
	// The recipe's tags that no other recipe uses, which the edit can respell.
	respellableTags: string[];
};

// What a signed-in member sees beside the public recipe: whether they may edit it.
export type RecipeMemberViewDto = {
	canEdit: boolean;
};

// Returned by writes, so callers can redirect to the recipe and invalidate its cache tags.
export type RecipeRef = {
	id: RecipeId;
	slug: string;
};

// The images an edit or delete let go: those the recipe named before the write and no longer does.
// Callers hand them to the image sweep, which removes each one nothing else names once the response
// is sent, so no save waits for the image move lock.
export type ReleasedImages = {
	recipeId: RecipeId;
	images: RecipeImage[];
};

// The previous slug is set only when the edit moved the slug, so its cache tag is invalidated too.
export type UpdatedRecipeRef = RecipeRef & {
	previousSlug?: string;
	releasedImages: ReleasedImages;
};

export type DeletedRecipeRef = RecipeRef & {
	releasedImages: ReleasedImages;
};

// What the upload adapter allows the one upload a member was authorized for.
export type ImageUploadGrant = {
	contentType: string;
	maximumSizeInBytes: number;
};

// How many images one sweep restored, deleted for good, and removed, how many in expiring
// environments' folders it deleted for good, and how many it left in place, for the next sweep to try
// again.
export type ImageSweepCounts = {
	restoredCount: number;
	deletedCount: number;
	removedCount: number;
	expiredCount: number;
	failedCount: number;
};

// The page an import read, or a source entered as a web address, which links as an import's does.
function publicSourceUrl({ provenance, source }: Recipe): string | undefined {
	if (provenance.entryMode === 'url') {
		return provenance.sourceUrl;
	}

	const result = sourceUrlSchema.safeParse(source);
	return result.success ? result.data : undefined;
}

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
		scans: scanImages(recipe.images),
		sourceUrl: publicSourceUrl(recipe),
		createdAt: recipe.createdAt,
		updatedAt: recipe.updatedAt,
	};
}

export function toEditableRecipeDto(recipe: Recipe, respellableTags: string[]): EditableRecipeDto {
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
		respellableTags,
	};
}

export function toRecipeMemberViewDto(canEdit: boolean): RecipeMemberViewDto {
	return { canEdit };
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
