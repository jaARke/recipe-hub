import { describe, expect, it } from 'vitest';
import {
	coverImage,
	dishImages,
	isPublicImagePathname,
	isScanImagePathname,
	recipeImageSchema,
	scanImages,
} from '@/domain/recipe/recipe-image';

describe('recipeImageSchema', () => {
	it('accepts an image stored under its role', () => {
		expect(
			recipeImageSchema.safeParse({ role: 'dish', pathname: 'dish/seed/soup.jpg' }).success
		).toBe(true);
		expect(
			recipeImageSchema.safeParse({ role: 'scan', pathname: 'scan/card-front.jpg' }).success
		).toBe(true);
	});

	it.each([
		{ role: 'dish', pathname: 'scan/plated.jpg' },
		{ role: 'scan', pathname: 'dish/card-front.jpg' },
		{ role: 'dish', pathname: 'plated.jpg' },
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
		expect(recipeImageSchema.safeParse({ role: 'dish', pathname }).success).toBe(false);
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

describe('isPublicImagePathname', () => {
	it('accepts a dish photo', () => {
		expect(isPublicImagePathname('dish/seed/soup.jpg')).toBe(true);
	});

	it.each([
		'scan/card-front.jpg',
		'plated.jpg',
		'dishes/plated.jpg',
		'dish/../scan/card-front.jpg',
		'dish/%2e%2e/scan/card-front.jpg',
	])('refuses %s', (pathname) => {
		expect(isPublicImagePathname(pathname)).toBe(false);
	});
});

describe('isScanImagePathname', () => {
	it('accepts a scan', () => {
		expect(isScanImagePathname('scan/seed/card-front.jpg')).toBe(true);
	});

	it.each([
		'dish/seed/soup.jpg',
		'card-front.jpg',
		'scans/card-front.jpg',
		'scan/../dish/soup.jpg',
		'scan/%2e%2e/dish/soup.jpg',
	])('refuses %s', (pathname) => {
		expect(isScanImagePathname(pathname)).toBe(false);
	});
});
