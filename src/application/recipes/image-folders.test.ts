import { describe, expect, it } from 'vitest';
import { ImageFolders } from '@/application/recipes/image-folders';
import { imageEnvironmentAccess } from '@/lib/image-paths';

const uuid = '3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b';

// A deployment's folders as src/composition/services.ts builds them, with its Vercel environment's
// access from src/lib/image-paths.ts.
function deploymentFolders(
	environment: string,
	vercelEnvironment: keyof typeof imageEnvironmentAccess
): ImageFolders {
	const { readableEnvironments, fetchedFromProduction } = imageEnvironmentAccess[vercelEnvironment];
	return new ImageFolders(environment, readableEnvironments, fetchedFromProduction);
}

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
	// Each reads its own images from its store. Previews and development also read the seed's, which
	// their stores hold too.
	const production = deploymentFolders('production', 'production');
	const preview = deploymentFolders('preview/feature-x-1a2b3c4d', 'preview');
	const development = deploymentFolders('development', 'development');

	it.each([
		['production', 'dish/production/soup.jpg', production],
		['production', 'scan/production/card.jpg', production],
		['a preview', 'dish/preview/feature-x-1a2b3c4d/soup.jpg', preview],
		['a preview', 'scan/preview/feature-x-1a2b3c4d/card.jpg', preview],
		['a preview', 'dish/seed/buttermilk-biscuits.jpg', preview],
		['development', 'scan/development/card.jpg', development],
		['development', 'dish/seed/buttermilk-biscuits.jpg', development],
	])('lets %s read %s', (_, pathname, folders) => {
		expect(folders.isReadable(pathname)).toBe(true);
	});

	it.each([
		['production', 'dish/seed/buttermilk-biscuits.jpg', production],
		['production', 'scan/preview/feature-x-1a2b3c4d/card.jpg', production],
		['production', 'dish/development/soup.jpg', production],
		['a preview', 'dish/production/soup.jpg', preview],
		['a preview', 'scan/production/card.jpg', preview],
		['a preview', 'scan/preview/feature-y-5e6f7a8b/card.jpg', preview],
		['a preview', 'dish/development/soup.jpg', preview],
		['development', 'dish/production/soup.jpg', development],
		['development', 'scan/production/card.jpg', development],
		['development', 'dish/preview/feature-x-1a2b3c4d/soup.jpg', development],
		['development', 'scan/production/../preview/feature-x/card.jpg', development],
		['development', 'dish/soup.jpg', development],
		['development', 'trash/dish/development/soup.jpg', development],
	])('keeps %s from reading %s', (_, pathname, folders) => {
		expect(folders.isReadable(pathname)).toBe(false);
	});
});

describe('isFetchedFromProduction', () => {
	// Only previews, whose databases copy production's recipes, show production's images, which they
	// fetch from production.
	const production = deploymentFolders('production', 'production');
	const preview = deploymentFolders('preview/feature-x-1a2b3c4d', 'preview');
	const development = deploymentFolders('development', 'development');

	it.each(['dish/production/soup.jpg', 'scan/production/card.jpg', `dish/production/${uuid}.jpg`])(
		'has a preview fetch %s from production',
		(pathname) => {
			expect(preview.isFetchedFromProduction(pathname)).toBe(true);
		}
	);

	it.each([
		'dish/preview/feature-x-1a2b3c4d/soup.jpg',
		'scan/preview/feature-y-5e6f7a8b/card.jpg',
		'dish/seed/buttermilk-biscuits.jpg',
		'dish/development/soup.jpg',
		'dish/productions/soup.jpg',
		'dish/production/../seed/buttermilk-biscuits.jpg',
		'trash/dish/production/soup.jpg',
		'menus/production/soup.jpg',
		'production/soup.jpg',
	])('never has a preview fetch %s from production', (pathname) => {
		expect(preview.isFetchedFromProduction(pathname)).toBe(false);
	});

	it.each([
		['production', production],
		['development', development],
	])('has %s fetch nothing from production', (_, folders) => {
		expect(folders.isFetchedFromProduction('dish/production/soup.jpg')).toBe(false);
		expect(folders.isFetchedFromProduction('scan/production/card.jpg')).toBe(false);
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
