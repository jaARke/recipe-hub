import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { RecipeImageService } from '@/application/recipes/recipe-image-service';
import { InMemoryImageStore } from '@/application/testing/in-memory-image-store';

const dishPhoto = 'dish/seed/soup.jpg';
const scan = 'scan/soup-card.jpg';
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

let consoleWarn: MockInstance<typeof console.warn>;

beforeEach(() => {
	// Keeps warning lines out of the test output; the content type test reads them here.
	consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
	vi.restoreAllMocks();
});

async function storeWithSoup() {
	const images = new InMemoryImageStore();
	await images.put(dishPhoto, jpeg, 'image/jpeg');
	await images.put(scan, jpeg, 'image/jpeg');
	return images;
}

describe('getPublicImage', () => {
	it('returns a dish photo', async () => {
		const service = new RecipeImageService(await storeWithSoup());

		const image = await service.getPublicImage(dishPhoto);

		expect(image).toMatchObject({
			contentType: 'image/jpeg',
			etag: expect.any(String),
		});
		expect(new Uint8Array(await new Response(image?.body).arrayBuffer())).toEqual(jpeg);
	});

	it.each([scan, 'menus/soup.jpg', 'dish/../scan/soup-card.jpg'])(
		'refuses %s without reading the store',
		async (pathname) => {
			const images = await storeWithSoup();
			const service = new RecipeImageService(images);

			expect(await service.getPublicImage(pathname)).toBeNull();
			expect(images.wasRead).toBe(false);
		}
	);

	it('refuses a stored file that is not an image type', async () => {
		const images = await storeWithSoup();
		await images.put('dish/seed/page.html', jpeg, 'text/html');
		const service = new RecipeImageService(images);

		expect(await service.getPublicImage('dish/seed/page.html')).toBeNull();
		expect(consoleWarn).toHaveBeenCalledOnce();
	});

	it('returns null for a dish photo the store does not have', async () => {
		const service = new RecipeImageService(await storeWithSoup());

		expect(await service.getPublicImage('dish/seed/biscuits.jpg')).toBeNull();
	});
});
