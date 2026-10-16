import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/images/[...path]/route';
import { ImageFolders } from '@/application/recipes/image-folders';
import { RecipeImageService } from '@/application/recipes/recipe-image-service';
import { anonymousActor } from '@/application/testing/actors';
import { FixedActorProvider } from '@/application/testing/fixed-actor-provider';
import { InMemoryImageMoveLock } from '@/application/testing/in-memory-image-move-lock';
import { InMemoryImageStore } from '@/application/testing/in-memory-image-store';
import { InMemoryRecipeImportRepository } from '@/application/testing/in-memory-recipe-import-repository';
import { InMemoryRecipeRepository } from '@/application/testing/in-memory-recipe-repository';
import { InMemorySavedDraftRepository } from '@/application/testing/in-memory-saved-draft-repository';

const services = vi.hoisted(() => ({ imageService: undefined as unknown }));

vi.mock('@/composition/services', () => ({
	getRecipeImageService: () => services.imageService,
}));

const dishPhoto = 'dish/seed/soup.jpg';
const scan = 'scan/seed/soup-card.jpg';
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

// The route's service over an in-memory store holding a dish photo and a scan, for a signed-out
// visitor.
async function serveImages() {
	const folders = new ImageFolders('development', ['seed']);
	const images = new InMemoryImageStore(folders);
	await images.put(dishPhoto, jpeg, 'image/jpeg');
	await images.put(scan, jpeg, 'image/jpeg');
	const recipes = new InMemoryRecipeRepository();
	services.imageService = new RecipeImageService(
		recipes,
		new InMemoryRecipeImportRepository(recipes),
		new InMemorySavedDraftRepository(),
		images,
		new FixedActorProvider(anonymousActor()),
		folders,
		new InMemoryImageMoveLock(),
		() => {},
		true
	);
}

function requestImage(pathname: string, query = ''): Promise<Response> {
	return GET(new NextRequest(`http://localhost/api/images/${pathname}${query}`), {
		params: Promise.resolve({ path: pathname.split('/') }),
	});
}

describe('the image route', () => {
	beforeEach(() => {
		services.imageService = undefined;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it.each([dishPhoto, scan])('lets anyone and every cache keep %s for a year', async (pathname) => {
		await serveImages();

		const response = await requestImage(pathname);

		expect(response.status).toBe(200);
		expect(response.headers.get('Content-Type')).toBe('image/jpeg');
		expect(response.headers.get('Cache-Control')).toBe(
			'public, max-age=31536000, s-maxage=31536000, immutable'
		);
		expect(response.headers.get('Vercel-Cache-Tag')).toBe(`image:${pathname}`);
	});

	it.each([dishPhoto, scan])('serves %s to the image optimizer', async (pathname) => {
		await serveImages();

		const response = await requestImage(pathname, '?_vercel_system=1');

		expect(response.status).toBe(200);
		expect(response.headers.get('Vercel-Cache-Tag')).toBe(`image:${pathname}`);
	});

	it('answers any other query with a 404 no cache keeps, so it never bypasses the cache', async () => {
		await serveImages();
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

		const response = await requestImage(scan, '?w=640');

		expect(response.status).toBe(404);
		expect(response.headers.get('Cache-Control')).toBe('no-store');
		expect(warn).toHaveBeenCalledOnce();
	});

	it.each(['trash/dish/seed/soup.jpg', 'scan/seed/missing.jpg'])(
		'answers %s with a 404 no cache keeps',
		async (pathname) => {
			await serveImages();

			const response = await requestImage(pathname);

			expect(response.status).toBe(404);
			expect(response.headers.get('Cache-Control')).toBe('no-store');
		}
	);
});
