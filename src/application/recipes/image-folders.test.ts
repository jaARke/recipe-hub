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

describe('environmentFolders', () => {
	it("names this environment's folder under each role's", () => {
		expect(new ImageFolders('production').environmentFolders()).toEqual([
			'dish/production/',
			'scan/production/',
		]);
	});
});

describe('isPreview', () => {
	it.each([
		['preview/feature-x-1a2b3c4d', true],
		['production', false],
		['development', false],
		['seed', false],
	])('says whether %s is a preview', (environment, isPreview) => {
		expect(new ImageFolders(environment).isPreview()).toBe(isPreview);
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

describe('isReadable', () => {
	// What src/lib/env.ts gives each deployment: production reads only its own images, and previews
	// and development also read production's and the seed's.
	const production = new ImageFolders('production');
	const preview = new ImageFolders('preview/feature-x', ['production', 'seed']);
	const development = new ImageFolders('development', ['production', 'seed']);

	it.each([
		['production', production, 'dish/production/soup.jpg'],
		['production', production, 'scan/production/card.jpg'],
		['a preview', preview, 'dish/preview/feature-x/soup.jpg'],
		['a preview', preview, 'scan/production/card.jpg'],
		['a preview', preview, 'dish/seed/buttermilk-biscuits.jpg'],
		['development', development, 'scan/development/card.jpg'],
		['development', development, 'dish/production/soup.jpg'],
		['development', development, 'dish/seed/buttermilk-biscuits.jpg'],
	])('lets %s read %s', (_, folders, pathname) => {
		expect(folders.isReadable(pathname)).toBe(true);
	});

	it.each([
		['production', production, 'dish/seed/buttermilk-biscuits.jpg'],
		['production', production, 'scan/preview/feature-x/card.jpg'],
		['production', production, 'dish/development/soup.jpg'],
		['a preview', preview, 'scan/preview/feature-y/card.jpg'],
		['a preview', preview, 'dish/development/soup.jpg'],
		['development', development, 'dish/preview/feature-x/soup.jpg'],
		['development', development, 'scan/production/../preview/feature-x/card.jpg'],
		['development', development, 'dish/soup.jpg'],
		['development', development, 'trash/dish/development/soup.jpg'],
	])('keeps %s from reading %s', (_, folders, pathname) => {
		expect(folders.isReadable(pathname)).toBe(false);
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
