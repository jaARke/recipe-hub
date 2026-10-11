import { z } from 'zod';
import { nonEmptyTextSchema } from '@/domain/recipe/text';

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

// Array order is display order.
export const recipeImageListSchema = z.array(recipeImageSchema).superRefine((images, context) => {
	const seen = new Set<string>();
	images.forEach((image, index) => {
		if (seen.has(image.pathname)) {
			context.addIssue({
				code: 'custom',
				message: 'This image is already attached.',
				path: [index, 'pathname'],
			});
		}
		seen.add(image.pathname);
	});
});

// The images anyone may see; scans stay with members.
export function dishImages(images: readonly RecipeImage[]): RecipeImage[] {
	return images.filter((image) => image.role === 'dish');
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
