import { describe, expect, it } from 'vitest';
import { ImageFolders } from '@/application/recipes/image-folders';

const uuid = '3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b';

describe('uploadFolder', () => {
	it.each([
		['production', 'dish', 'dish/production/'],
		['development', 'scan', 'scan/development/'],
		['preview/session-6-authoring', 'dish', 'dish/preview/session-6-authoring/'],
	] as const)('puts %s images with the role %s in %s', (environment, role, folder) => {
		expect(new ImageFolders(environment).uploadFolder(role)).toBe(folder);
	});
});

describe('contains', () => {
	const folders = new ImageFolders('preview/feature-x');

	it.each([
		'dish/preview/feature-x/photo.jpg',
		'scan/preview/feature-x/card.jpg',
		`dish/preview/feature-x/${uuid}.jpg`,
	])('includes %s', (pathname) => {
		expect(folders.contains(pathname)).toBe(true);
	});

	it.each([
		'dish/production/photo.jpg',
		'dish/preview/photo.jpg',
		'dish/preview/feature-xy/photo.jpg',
		'dish/preview/feature-x',
		'dish/preview/feature-x/',
		'dish/preview/feature-x/../../production/photo.jpg',
		'menus/preview/feature-x/photo.jpg',
		'preview/feature-x/photo.jpg',
	])('excludes %s', (pathname) => {
		expect(folders.contains(pathname)).toBe(false);
	});

	it("includes the seed's photos for the seed", () => {
		expect(new ImageFolders('seed').contains('dish/seed/buttermilk-biscuits.jpg')).toBe(true);
	});
});

describe('isUploadName', () => {
	const folders = new ImageFolders('development');

	it.each([`dish/development/${uuid}.jpg`, `scan/development/${uuid}.jpg`])(
		'accepts %s',
		(pathname) => {
			expect(folders.isUploadName(pathname)).toBe(true);
		}
	);

	it.each([
		`dish/production/${uuid}.jpg`,
		`dish/development/${uuid}.jpeg`,
		`dish/development/${uuid}.png`,
		`dish/development/${uuid}`,
		`dish/development/extra/${uuid}.jpg`,
		`dish/development/../production/${uuid}.jpg`,
		`development/${uuid}.jpg`,
		'dish/development/photo.jpg',
		// Version 7, which crypto.randomUUID() never makes.
		'dish/development/0199c7a4-2c3e-7b1a-9f00-2a7c1e4b5d6e.jpg',
	])('refuses %s', (pathname) => {
		expect(folders.isUploadName(pathname)).toBe(false);
	});
});
