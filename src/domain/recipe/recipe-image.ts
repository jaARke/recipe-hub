import { z } from 'zod';
import { nonEmptyTextSchema } from '@/domain/recipe/text';

// Dish photos are public; scans, the original photos of a written recipe, are for members only.
export const recipeImageRoleSchema = z.enum(['dish', 'scan']);
export type RecipeImageRole = z.infer<typeof recipeImageRoleSchema>;

export const recipeImageSchema = z.object({
	role: recipeImageRoleSchema,
	pathname: nonEmptyTextSchema,
	alt: nonEmptyTextSchema.optional(),
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
