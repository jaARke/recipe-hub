import { describe, expect, it } from 'vitest';
import { parseRecipeContent } from '@/domain/recipe/recipe';
import { sampleChickenSoup } from '@/domain/recipe/samples/sample-recipes';
import { toRecipe } from '@/infrastructure/db/recipe-mapper';
import { settings } from '@/lib/settings';

const longTitle = 'a'.repeat(settings.recipeLimits.maxTitleLength + 1);
const longTag = 'a'.repeat(settings.recipeLimits.maxTagLength + 1);
const dishPhotos = Array.from(
	{ length: settings.photos.maxDishPhotosPerRecipe + 1 },
	(_, index) => ({ role: 'dish', pathname: `dish/production/photo-${index}.jpg` }) as const
);

// A recipe saved before its limits were lowered: past the title's, a tag's, and the dish photos'.
const row = {
	id: '0199c7a4-2c3e-7b1a-9f00-2a7c1e4b5d6e',
	slug: 'weeknight-chicken-soup',
	contributorId: '3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b',
	content: { ...sampleChickenSoup, title: longTitle, images: dishPhotos },
	provenance: { entryMode: 'manual' },
	tags: ['Soup', longTag],
	createdAt: new Date('2026-10-10T12:00:00Z'),
	updatedAt: new Date('2026-10-10T12:00:00Z'),
};

describe('toRecipe', () => {
	it('reads a recipe stored past lowered limits, whose next save names each field', () => {
		const recipe = toRecipe(row);

		expect(recipe).toMatchObject({ title: longTitle, tags: ['Soup', longTag], images: dishPhotos });
		expect(() => parseRecipeContent(recipe)).toThrow(
			expect.objectContaining({
				problems: [
					{
						path: 'title',
						message: `Use ${settings.recipeLimits.maxTitleLength} characters or fewer.`,
					},
					{
						path: 'tags.1',
						message: `Use ${settings.recipeLimits.maxTagLength} characters or fewer.`,
					},
					{
						path: `images.${settings.photos.maxDishPhotosPerRecipe}`,
						message: `Use ${settings.photos.maxDishPhotosPerRecipe} photos or fewer.`,
					},
				],
			})
		);
	});
});
