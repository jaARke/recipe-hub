import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { SignInRequiredError } from '@/application/authorization';
import type { Actor } from '@/application/ports/actor-provider';
import { RecipeImageService } from '@/application/recipes/recipe-image-service';
import { anonymousActor, memberActor } from '@/application/testing/actors';
import { FixedActorProvider } from '@/application/testing/fixed-actor-provider';
import { InMemoryImageStore } from '@/application/testing/in-memory-image-store';

const dishPhoto = 'dish/seed/soup.jpg';
const scan = 'scan/soup-card.jpg';
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

let consoleWarn: MockInstance<typeof console.warn>;

beforeEach(() => {
	// Keeps warning lines out of the test output; the content type tests read them here.
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

function serviceFor(images: InMemoryImageStore, actor: Actor) {
	const actors = new FixedActorProvider(actor);
	return { actors, service: new RecipeImageService(images, actors) };
}

async function bytes(body: ReadableStream<Uint8Array> | undefined): Promise<Uint8Array> {
	return new Uint8Array(await new Response(body).arrayBuffer());
}

describe('getPublicImage', () => {
	it('returns a dish photo without asking who is calling, so responses can be cached', async () => {
		const { actors, service } = serviceFor(await storeWithSoup(), memberActor());

		const image = await service.getPublicImage(dishPhoto);

		expect(image).toMatchObject({
			contentType: 'image/jpeg',
			etag: expect.any(String),
		});
		expect(await bytes(image?.body)).toEqual(jpeg);
		expect(actors.wasAsked).toBe(false);
	});

	it.each([scan, 'menus/soup.jpg', 'dish/../scan/soup-card.jpg'])(
		'refuses %s without reading the store',
		async (pathname) => {
			const images = await storeWithSoup();
			const { service } = serviceFor(images, anonymousActor());

			expect(await service.getPublicImage(pathname)).toBeNull();
			expect(images.wasRead).toBe(false);
		}
	);

	it('refuses a stored file that is not an image type', async () => {
		const images = await storeWithSoup();
		await images.put('dish/seed/page.html', jpeg, 'text/html');
		const { service } = serviceFor(images, anonymousActor());

		expect(await service.getPublicImage('dish/seed/page.html')).toBeNull();
		expect(consoleWarn).toHaveBeenCalledOnce();
	});

	it('returns null for a dish photo the store does not have', async () => {
		const { service } = serviceFor(await storeWithSoup(), anonymousActor());

		expect(await service.getPublicImage('dish/seed/biscuits.jpg')).toBeNull();
	});
});

describe('getMemberImage', () => {
	it.each([scan, 'scan/missing.jpg', dishPhoto])(
		'refuses an anonymous visitor asking for %s without reading the store',
		async (pathname) => {
			const images = await storeWithSoup();
			const { service } = serviceFor(images, anonymousActor());

			await expect(service.getMemberImage(pathname)).rejects.toThrow(SignInRequiredError);
			expect(images.wasRead).toBe(false);
		}
	);

	it('returns a scan to a member', async () => {
		const { service } = serviceFor(await storeWithSoup(), memberActor());

		const image = await service.getMemberImage(scan);

		expect(image).toMatchObject({ contentType: 'image/jpeg' });
		expect(await bytes(image?.body)).toEqual(jpeg);
	});

	it.each([dishPhoto, 'menus/soup-card.jpg', 'scan/../dish/seed/soup.jpg', 'scan/%2e%2e/dish'])(
		'refuses %s to a member without reading the store',
		async (pathname) => {
			const images = await storeWithSoup();
			const { service } = serviceFor(images, memberActor());

			expect(await service.getMemberImage(pathname)).toBeNull();
			expect(images.wasRead).toBe(false);
		}
	);

	it('refuses a stored scan that is not an image type', async () => {
		const images = await storeWithSoup();
		await images.put('scan/card.pdf', jpeg, 'application/pdf');
		const { service } = serviceFor(images, memberActor());

		expect(await service.getMemberImage('scan/card.pdf')).toBeNull();
		expect(consoleWarn).toHaveBeenCalledOnce();
	});

	it('returns null for a scan the store does not have', async () => {
		const { service } = serviceFor(await storeWithSoup(), memberActor());

		expect(await service.getMemberImage('scan/biscuit-card.jpg')).toBeNull();
	});
});
