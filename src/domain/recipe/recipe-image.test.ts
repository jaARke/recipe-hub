import { describe, expect, it } from 'vitest';
import { storedContent, writtenContent } from '@/domain/recipe/content-limits';
import {
	coverImage,
	dishImages,
	imagePathnameSchema,
	imageSizeSchema,
	maxImageSideInPixels,
	recipeImageListSchemaFor,
	recipeImageSchema,
	scanImages,
	storedImageSizeSchema,
	type RecipeImage,
	type RecipeImageRole,
} from '@/domain/recipe/recipe-image';
import { settings } from '@/lib/settings';

// A dish photo as the browser draws one from a phone's landscape photo.
const photoSize = { width: 2400, height: 1800 };

describe('imageSizeSchema', () => {
	it.each([
		{ width: 2400, height: 1800 },
		{ width: 1, height: 1 },
		{ width: 3072, height: 1600 },
		{ width: 1600, height: 3072 },
	])('accepts %o', (size) => {
		expect(imageSizeSchema.parse(size)).toEqual(size);
	});

	it.each([
		{ width: 3073, height: 1600 },
		{ width: 1600, height: 3073 },
	])('refuses %o, past the longest side a recipe accepts', (size) => {
		expect(imageSizeSchema.safeParse(size).error?.issues).toEqual([
			expect.objectContaining({
				path: [],
				message: 'This photo is too large. Remove it and add it again.',
			}),
		]);
	});

	it.each([
		{ width: 0, height: 1800 },
		{ width: 2400, height: -1 },
		{ width: 2400.5, height: 1800 },
		{ width: 2400 },
	])('refuses %o, which is no size in pixels', (size) => {
		expect(imageSizeSchema.safeParse(size).success).toBe(false);
	});
});

describe('storedImageSizeSchema', () => {
	it('reads a size past the longest side a recipe accepts now', () => {
		const size = { width: maxImageSideInPixels * 2, height: 1600 };

		expect(storedImageSizeSchema.parse(size)).toEqual(size);
	});

	it('refuses what is no size in pixels', () => {
		expect(storedImageSizeSchema.safeParse({ width: 0, height: 1800 }).success).toBe(false);
	});
});

describe('recipeImageSchema', () => {
	it.each([
		{ role: 'dish', pathname: 'dish/seed/soup.jpg', size: photoSize },
		{ role: 'scan', pathname: 'scan/card-front.jpg', size: photoSize },
	])('accepts %o, stored under its role', (image) => {
		expect(recipeImageSchema.parse(image)).toEqual(image);
	});

	it.each([
		{ role: 'dish', pathname: 'scan/plated.jpg', size: photoSize },
		{ role: 'scan', pathname: 'dish/card-front.jpg', size: photoSize },
		{ role: 'dish', pathname: 'plated.jpg', size: photoSize },
	])('rejects %o at its pathname', (image) => {
		const result = recipeImageSchema.safeParse(image);
		expect(result.error?.issues.map((issue) => issue.path)).toEqual([['pathname']]);
	});

	it.each([
		'dish/../scan/card-front.jpg',
		'dish/%2e%2e/scan/card-front.jpg',
		'dish/..\\scan/card-front.jpg',
		'dish/./plated.jpg',
		'dish//plated.jpg',
		'/dish/plated.jpg',
		'dish/',
	])('rejects the pathname %s, which could leave its folder', (pathname) => {
		const image = { role: 'dish', pathname, size: photoSize };
		expect(recipeImageSchema.safeParse(image).success).toBe(false);
	});

	it('refuses an image without its size, at its size', () => {
		const result = recipeImageSchema.safeParse({ role: 'dish', pathname: 'dish/plated.jpg' });

		expect(result.error?.issues).toEqual([
			expect.objectContaining({
				path: ['size'],
				message: 'We couldn’t read this photo’s size. Remove it and add it again.',
			}),
		]);
	});
});

describe('imagePathnameSchema', () => {
	it.each(['dish/production/soup.jpg', 'scan/preview/feature-x/card.v2.jpg', 'plated.jpg'])(
		'accepts %s, in plain segments',
		(pathname) => {
			expect(imagePathnameSchema.safeParse(pathname).success).toBe(true);
		}
	);

	it.each(['dish/../scan/card-front.jpg', 'dish/%2e%2e/card.jpg', 'dish//plated.jpg', 'dish/'])(
		'refuses %s, which could leave its folder',
		(pathname) => {
			expect(imagePathnameSchema.safeParse(pathname).success).toBe(false);
		}
	);
});

describe('recipeImageListSchemaFor', () => {
	const recipeImageListSchema = recipeImageListSchemaFor(writtenContent);

	function images(role: RecipeImageRole, count: number): RecipeImage[] {
		return Array.from({ length: count }, (_, index) => ({
			role,
			pathname: `${role}/image-${index}.jpg`,
			size: photoSize,
		}));
	}

	it('accepts as many dish photos and scans as a recipe keeps', () => {
		const list = [
			...images('dish', settings.photos.maxDishPhotosPerRecipe),
			...images('scan', settings.photos.maxScansPerRecipe),
		];

		expect(recipeImageListSchema.safeParse(list).success).toBe(true);
	});

	it('refuses each role past its limit once, on its first image past it', () => {
		const list = [
			...images('dish', settings.photos.maxDishPhotosPerRecipe + 1),
			...images('scan', settings.photos.maxScansPerRecipe + 2),
		];

		expect(recipeImageListSchema.safeParse(list).error?.issues).toEqual([
			expect.objectContaining({
				path: [settings.photos.maxDishPhotosPerRecipe],
				message: `Use ${settings.photos.maxDishPhotosPerRecipe} photos or fewer.`,
			}),
			expect.objectContaining({
				path: [settings.photos.maxDishPhotosPerRecipe + 1 + settings.photos.maxScansPerRecipe],
				message: `Use ${settings.photos.maxScansPerRecipe} photos or fewer.`,
			}),
		]);
	});

	it('refuses alt text past its limit when written, and reads any stored', () => {
		const alt = 'a'.repeat(settings.recipeLimits.maxImageAltLength + 1);
		const list = [{ role: 'dish', pathname: 'dish/plated.jpg', alt, size: photoSize }];

		expect(recipeImageListSchema.safeParse(list).error?.issues).toEqual([
			expect.objectContaining({
				path: [0, 'alt'],
				message: `Use ${settings.recipeLimits.maxImageAltLength} characters or fewer.`,
			}),
		]);
		expect(recipeImageListSchemaFor(storedContent).parse(list)).toEqual(list);
	});

	it('refuses each image without its size when written, at the image', () => {
		const list = [
			{ role: 'dish', pathname: 'dish/plated.jpg', size: photoSize },
			{ role: 'dish', pathname: 'dish/sliced.jpg' },
			{ role: 'scan', pathname: 'scan/card-front.jpg' },
		];

		expect(recipeImageListSchema.safeParse(list).error?.issues).toEqual([
			expect.objectContaining({
				path: [1, 'size'],
				message: 'We couldn’t read this photo’s size. Remove it and add it again.',
			}),
			expect.objectContaining({
				path: [2, 'size'],
				message: 'We couldn’t read this photo’s size. Remove it and add it again.',
			}),
		]);
	});

	it('reads stored images without a size, and keeps the sizes of those with one', () => {
		const list = [
			{ role: 'dish', pathname: 'dish/plated.jpg', size: photoSize },
			{ role: 'scan', pathname: 'scan/card-front.jpg' },
		];

		expect(recipeImageListSchemaFor(storedContent).parse(list)).toEqual(list);
	});

	it("refuses a size past the longest side when written, and reads one stored, at the image's size", () => {
		const list = [
			{ role: 'scan', pathname: 'scan/card-front.jpg', size: { width: 4032, height: 3024 } },
		];

		expect(recipeImageListSchema.safeParse(list).error?.issues).toEqual([
			expect.objectContaining({
				path: [0, 'size'],
				message: 'This photo is too large. Remove it and add it again.',
			}),
		]);
		expect(recipeImageListSchemaFor(storedContent).parse(list)).toEqual(list);
	});

	it("reads stored images past either role's limit", () => {
		const list = [
			...images('dish', settings.photos.maxDishPhotosPerRecipe + 1),
			...images('scan', settings.photos.maxScansPerRecipe + 1),
		];

		expect(recipeImageListSchemaFor(storedContent).parse(list)).toEqual(list);
	});
});

describe('dishImages and scanImages', () => {
	const firstScan = { role: 'scan', pathname: 'scan/card-front.jpg' } as const;
	const dish = { role: 'dish', pathname: 'dish/plated.jpg' } as const;
	const secondScan = { role: 'scan', pathname: 'scan/card-back.jpg' } as const;

	it('separates dish photos from scans and keeps their order', () => {
		expect(dishImages([firstScan, dish, secondScan])).toEqual([dish]);
		expect(scanImages([firstScan, dish, secondScan])).toEqual([firstScan, secondScan]);
	});
});

describe('coverImage', () => {
	it('is the first dish photo', () => {
		const scan = { role: 'scan', pathname: 'scan/card-front.jpg' } as const;
		const first = { role: 'dish', pathname: 'dish/plated.jpg' } as const;
		const second = { role: 'dish', pathname: 'dish/sliced.jpg' } as const;

		expect(coverImage([scan, first, second])).toBe(first);
	});

	it('is undefined without a dish photo', () => {
		expect(coverImage([{ role: 'scan', pathname: 'scan/card-front.jpg' }])).toBeUndefined();
		expect(coverImage([])).toBeUndefined();
	});
});
