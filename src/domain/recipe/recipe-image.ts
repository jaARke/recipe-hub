import { z } from 'zod';
import { writtenContent, type ContentLimits } from '@/domain/recipe/content-limits';
import { limitMessage } from '@/domain/text';
import { settings } from '@/lib/settings';

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

// What a photo this environment never stored is told: its upload failed, was cut off, or never
// happened.
export const unstoredImageMessage = 'This photo didn’t upload. Remove it and add it again.';

// Dish photos are public; scans, the original photos of a written recipe, are for members only.
export const recipeImageRoleSchema = z.enum(['dish', 'scan']);
export type RecipeImageRole = z.infer<typeof recipeImageRoleSchema>;

function recipeImageSchemaFor(limits: ContentLimits) {
	return z
		.object({
			role: recipeImageRoleSchema,
			pathname: imagePathnameSchema,
			alt: limits.text(settings.recipeLimits.maxImageAltLength).optional(),
		})
		.refine((image) => image.pathname.startsWith(imagePathnamePrefix(image.role)), {
			message: 'Store the image under the folder for its role.',
			path: ['pathname'],
		});
}

export const recipeImageSchema = recipeImageSchemaFor(writtenContent);
export type RecipeImage = z.infer<typeof recipeImageSchema>;

const maxImagesByRole: Record<RecipeImageRole, number> = {
	dish: settings.photos.maxDishPhotosPerRecipe,
	scan: settings.photos.maxScansPerRecipe,
};

// Array order is display order. A role over its limit has one problem, on its first image past it.
export function recipeImageListSchemaFor(limits: ContentLimits) {
	return z.array(recipeImageSchemaFor(limits)).superRefine((images, context) => {
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
			const max = maxImagesByRole[image.role];
			if (counts[image.role] === max + 1 && limits.exceeds(counts[image.role], max)) {
				context.addIssue({ code: 'custom', message: limitMessage(max, 'photos'), path: [index] });
			}
		});
	});
}

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
