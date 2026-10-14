import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/images/[...path]/route';
import type { Actor } from '@/application/ports/actor-provider';
import { ImageFolders } from '@/application/recipes/image-folders';
import { RecipeImageService } from '@/application/recipes/recipe-image-service';
import { anonymousActor, memberActor } from '@/application/testing/actors';
import { FixedActorProvider } from '@/application/testing/fixed-actor-provider';
import { InMemoryImageMoveLock } from '@/application/testing/in-memory-image-move-lock';
import { InMemoryImageStore } from '@/application/testing/in-memory-image-store';
import { InMemoryRecipeImportRepository } from '@/application/testing/in-memory-recipe-import-repository';
import { InMemoryRecipeRepository } from '@/application/testing/in-memory-recipe-repository';

const services = vi.hoisted(() => ({ imageService: undefined as unknown }));

vi.mock('@/composition/services', () => ({
	getRecipeImageService: () => services.imageService,
}));

const dishPhoto = 'dish/seed/soup.jpg';
const scan = 'scan/seed/soup-card.jpg';
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

// The route's service over an in-memory store holding a dish photo and a scan, for this actor.
async function serveImagesTo(actor: Actor) {
	const folders = new ImageFolders('development', ['seed']);
	const images = new InMemoryImageStore(folders);
	await images.put(dishPhoto, jpeg, 'image/jpeg');
	await images.put(scan, jpeg, 'image/jpeg');
	const recipes = new InMemoryRecipeRepository();
	services.imageService = new RecipeImageService(
		recipes,
		new InMemoryRecipeImportRepository(recipes),
		images,
		new FixedActorProvider(actor),
		folders,
		new InMemoryImageMoveLock(),
		() => {}
	);
}

function requestImage(pathname: string): Promise<Response> {
	return GET(new NextRequest(`http://localhost/api/images/${pathname}`), {
		params: Promise.resolve({ path: pathname.split('/') }),
	});
}

describe('the image route', () => {
	beforeEach(() => {
		services.imageService = undefined;
	});

	it('lets only a member’s own browser keep a scan, for a day', async () => {
		await serveImagesTo(memberActor());

		const response = await requestImage(scan);

		expect(response.status).toBe(200);
		expect(response.headers.get('Cache-Control')).toBe('private, max-age=86400, immutable');
		expect(response.headers.get('Vercel-Cache-Tag')).toBeNull();
	});

	it('lets every cache keep a dish photo for a year', async () => {
		await serveImagesTo(anonymousActor());

		const response = await requestImage(dishPhoto);

		expect(response.status).toBe(200);
		expect(response.headers.get('Cache-Control')).toBe(
			'public, max-age=31536000, s-maxage=31536000, immutable'
		);
		expect(response.headers.get('Vercel-Cache-Tag')).toBe(`image:${dishPhoto}`);
	});

	it('answers a signed-out visitor’s scan request with a 404 no cache keeps', async () => {
		await serveImagesTo(anonymousActor());

		const response = await requestImage(scan);

		expect(response.status).toBe(404);
		expect(response.headers.get('Cache-Control')).toBe('no-store');
	});
});
