import { z } from 'zod';
import { storedContent, writtenContent, type ContentLimits } from '@/domain/recipe/content-limits';
import { limitMessage } from '@/domain/text';
import { settings } from '@/lib/settings';

// An image's pathname, in plain segments only: in a URL, `..`, `%2e%2e`, or `\` would climb out of
// the folder it starts in.
export const imagePathnameSchema = z
	.string()
	.regex(
		/^[\w-][\w.-]*(?:\/[\w-][\w.-]*)*$/,
		'Use letters, numbers, hyphens, underscores, and dots, separated by slashes.'
	);

// Types every browser displays; anything else is never served as a recipe image.
const recipeImageContentTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

// Each image is stored under its role, so a pathname alone shows its role.
function imagePathnamePrefix(role: RecipeImageRole): string {
	return `${role}/`;
}

// What a photo this environment never stored is told: its upload failed, was cut off, or never
// happened.
export const unstoredImageMessage = 'This photo didn’t upload. Remove it and add it again.';

// What a written image without its size is told: one stored before sizes were recorded, or kept in
// a browser from before. Adding it again records its size.
export const unsizedImageMessage =
	'We couldn’t read this photo’s size. Remove it and add it again.';

// The longest side, in pixels, of an image written to a recipe. The browser draws a scan, its largest
// photo, at this long edge (photo-processing.ts), and the seed's photos are smaller.
export const maxImageSideInPixels = 3072;

// Adding the photo again draws it within the longest side.
const oversizedImageMessage = 'This photo is too large. Remove it and add it again.';

// Dish photos show the finished dish; scans are the original photos of a written recipe. Anyone may
// see either.
export const recipeImageRoleSchema = z.enum(['dish', 'scan']);
export type RecipeImageRole = z.infer<typeof recipeImageRoleSchema>;

function imageSizeSchemaFor(limits: ContentLimits) {
	return z
		.object({ width: z.int().positive(), height: z.int().positive() })
		.refine(
			(size) => !limits.exceeds(Math.max(size.width, size.height), maxImageSideInPixels),
			oversizedImageMessage
		);
}

// An image's width and height in pixels, as stored, so a page can lay it out before it loads.
export const imageSizeSchema = imageSizeSchemaFor(writtenContent);
export const storedImageSizeSchema = imageSizeSchemaFor(storedContent);
export type ImageSize = z.infer<typeof imageSizeSchema>;

function recipeImageSchemaFor(limits: ContentLimits) {
	return z
		.object({
			role: recipeImageRoleSchema,
			pathname: imagePathnameSchema,
			alt: limits.text(settings.recipeLimits.maxImageAltLength).optional(),
			// Absent from an image stored before sizes were recorded, which written content refuses.
			size: imageSizeSchemaFor(limits).optional(),
		})
		.refine((image) => image.pathname.startsWith(imagePathnamePrefix(image.role)), {
			message: 'Store the image under the folder for its role.',
			path: ['pathname'],
		})
		.refine((image) => !limits.missing(image.size), {
			message: unsizedImageMessage,
			path: ['size'],
		});
}

// An image as written content holds it, with its size.
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

// The photos of the finished dish, the only images a cover, share card, or search engine is given.
export function dishImages(images: readonly RecipeImage[]): RecipeImage[] {
	return images.filter((image) => image.role === 'dish');
}

// The original photos of a written recipe, shown apart from the dish photos.
export function scanImages(images: readonly RecipeImage[]): RecipeImage[] {
	return images.filter((image) => image.role === 'scan');
}

export function coverImage(images: readonly RecipeImage[]): RecipeImage | undefined {
	return dishImages(images)[0];
}

export function isRecipeImageContentType(contentType: string): boolean {
	return recipeImageContentTypes.includes(contentType);
}
