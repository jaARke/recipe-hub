import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { SignInRequiredError } from '@/application/authorization';
import type { Actor } from '@/application/ports/actor-provider';
import { InvalidImageUploadError } from '@/application/recipes/errors';
import { ImageFolders } from '@/application/recipes/image-folders';
import { RecipeImageService } from '@/application/recipes/recipe-image-service';
import { anonymousActor, memberActor } from '@/application/testing/actors';
import { FixedActorProvider } from '@/application/testing/fixed-actor-provider';
import { InMemoryImageStore } from '@/application/testing/in-memory-image-store';

const dishPhoto = 'dish/seed/soup.jpg';
const scan = 'scan/soup-card.jpg';
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
const upload = 'dish/development/3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b.jpg';
const scanUpload = 'scan/development/0b6e2f4a-9c1d-4e8b-a7f3-5d2c1b0a9e8f.jpg';

let consoleInfo: MockInstance<typeof console.info>;
let consoleWarn: MockInstance<typeof console.warn>;

beforeEach(() => {
	// Keeps log lines out of the test output; the tests that check logging read them here.
	consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => {});
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
	return {
		actors,
		service: new RecipeImageService(images, actors, new ImageFolders('development')),
	};
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

describe('uploadFolders', () => {
	it("names this environment's folder for each role", () => {
		const { service } = serviceFor(new InMemoryImageStore(), memberActor());

		expect(service.uploadFolders()).toEqual({
			dish: 'dish/development/',
			scan: 'scan/development/',
		});
	});
});

describe('authorizeUpload', () => {
	it('refuses an anonymous visitor', async () => {
		const { service } = serviceFor(new InMemoryImageStore(), anonymousActor());

		await expect(service.authorizeUpload(upload)).rejects.toThrow(SignInRequiredError);
		expect(consoleInfo).not.toHaveBeenCalled();
	});

	it.each([upload, scanUpload])(
		'lets a member upload one JPEG of up to 8 MB to %s, and logs it',
		async (pathname) => {
			const member = memberActor();
			const { service } = serviceFor(new InMemoryImageStore(), member);

			expect(await service.authorizeUpload(pathname)).toEqual({
				contentType: 'image/jpeg',
				maximumSizeInBytes: 8 * 1024 * 1024,
			});
			expect(consoleInfo).toHaveBeenCalledOnce();
			expect(JSON.parse(String(consoleInfo.mock.calls[0]?.[0]))).toEqual({
				level: 'info',
				logger: 'images',
				message: 'Image upload authorized',
				memberId: member.memberId,
				pathname,
			});
		}
	);

	it.each([
		'dish/production/3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b.jpg',
		'dish/development/soup.jpg',
		'dish/development/3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b.png',
		'dish/development/../../scan/production/3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b.jpg',
	])('refuses %s, which is not a new upload in this environment', async (pathname) => {
		const { service } = serviceFor(new InMemoryImageStore(), memberActor());

		await expect(service.authorizeUpload(pathname)).rejects.toThrow(InvalidImageUploadError);
		expect(consoleInfo).not.toHaveBeenCalled();
		expect(consoleWarn).toHaveBeenCalledOnce();
	});
});
