import { z } from 'zod';
import { maxDishPhotos, maxScans } from '@/domain/recipe/recipe-image-limits';
import { nonEmptyTextSchema } from '@/domain/text';

// Plain segments only: in a URL, `..`, `%2e%2e`, or `\` would climb out of the role's folder.
const imagePathnameSchema = z
	.string()
	.regex(
		/^[\w-][\w.-]*(?:\/[\w-][\w.-]*)*$/,
		'Use letters, numbers, hyphens, underscores, and dots, separated by slashes.'
	);

// Types every browser displays; anything else is never served as a recipe image.
const recipeImageContentTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

// Each image is stored under its role, so a pathname alone shows who may see it.
function imagePathnamePrefix(role: RecipeImageRole): string {
	return `${role}/`;
}

// Dish photos are public; scans, the original photos of a written recipe, are for members only.
export const recipeImageRoleSchema = z.enum(['dish', 'scan']);
export type RecipeImageRole = z.infer<typeof recipeImageRoleSchema>;

export const recipeImageSchema = z
	.object({
		role: recipeImageRoleSchema,
		pathname: imagePathnameSchema,
		alt: nonEmptyTextSchema.optional(),
	})
	.refine((image) => image.pathname.startsWith(imagePathnamePrefix(image.role)), {
		message: 'Store the image under the folder for its role.',
		path: ['pathname'],
	});
export type RecipeImage = z.infer<typeof recipeImageSchema>;

const maxImagesByRole: Record<RecipeImageRole, number> = { dish: maxDishPhotos, scan: maxScans };

// Array order is display order. A role over its limit has one problem, on its first image past it.
export const recipeImageListSchema = z.array(recipeImageSchema).superRefine((images, context) => {
	const seen = new Set<string>();
	const counts: Record<RecipeImageRole, number> = { dish: 0, scan: 0 };
	images.forEach((image, index) => {
		if (seen.has(image.pathname)) {
			context.addIssue({
				code: 'custom',
				message: 'This image is already attached.',
				path: [index, 'pathname'],
			});
		}
		seen.add(image.pathname);

		counts[image.role] += 1;
		if (counts[image.role] === maxImagesByRole[image.role] + 1) {
			context.addIssue({
				code: 'custom',
				message: `Use ${maxImagesByRole[image.role]} photos or fewer.`,
				path: [index],
			});
		}
	});
});

// The images anyone may see; scans stay with members.
export function dishImages(images: readonly RecipeImage[]): RecipeImage[] {
	return images.filter((image) => image.role === 'dish');
}

// The images only members may see: the original photos of a written recipe.
export function scanImages(images: readonly RecipeImage[]): RecipeImage[] {
	return images.filter((image) => image.role === 'scan');
}

export function coverImage(images: readonly RecipeImage[]): RecipeImage | undefined {
	return dishImages(images)[0];
}

export function isRecipeImageContentType(contentType: string): boolean {
	return recipeImageContentTypes.includes(contentType);
}

// Whether a requested pathname names a dish photo, which anyone may see.
export function isPublicImagePathname(pathname: string): boolean {
	return recipeImageSchema.safeParse({ role: 'dish', pathname }).success;
}

// Whether a requested pathname names a scan, which only members may see.
export function isScanImagePathname(pathname: string): boolean {
	return recipeImageSchema.safeParse({ role: 'scan', pathname }).success;
}
