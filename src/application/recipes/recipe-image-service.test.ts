import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { SignInRequiredError } from '@/application/authorization';
import type { Actor } from '@/application/ports/actor-provider';
import { InvalidImageUploadError } from '@/application/recipes/errors';
import { ImageFolders } from '@/application/recipes/image-folders';
import { RecipeImageService } from '@/application/recipes/recipe-image-service';
import { anonymousActor, memberActor } from '@/application/testing/actors';
import { FixedActorProvider } from '@/application/testing/fixed-actor-provider';
import { InMemoryImageStore } from '@/application/testing/in-memory-image-store';
import { InMemoryRecipeImportRepository } from '@/application/testing/in-memory-recipe-import-repository';
import { InMemoryRecipeRepository } from '@/application/testing/in-memory-recipe-repository';
import { recipeContentSchema } from '@/domain/recipe/recipe';
import type { RecipeImage } from '@/domain/recipe/recipe-image';
import { sampleChickenSoup } from '@/domain/recipe/samples/sample-recipes';

const dishPhoto = 'dish/seed/soup.jpg';
const scan = 'scan/production/soup-card.jpg';
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
const upload = 'dish/development/3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b.jpg';
const scanUpload = 'scan/development/0b6e2f4a-9c1d-4e8b-a7f3-5d2c1b0a9e8f.jpg';
// As src/lib/env.ts sets up development, which also reads production's and the seed's images.
const folders = new ImageFolders('development', ['production', 'seed']);
const dayInMilliseconds = 24 * 60 * 60 * 1000;

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
	const images = new InMemoryImageStore(folders);
	await images.put(dishPhoto, jpeg, 'image/jpeg');
	await images.put(scan, jpeg, 'image/jpeg');
	return images;
}

function serviceFor(images: InMemoryImageStore, actor: Actor) {
	const actors = new FixedActorProvider(actor);
	const recipes = new InMemoryRecipeRepository();
	return {
		actors,
		service: new RecipeImageService(
			recipes,
			new InMemoryRecipeImportRepository(recipes),
			images,
			actors,
			folders
		),
	};
}

// As src/lib/env.ts sets up production, which reads only its own images.
function productionServiceFor(images: InMemoryImageStore, actor: Actor) {
	const recipes = new InMemoryRecipeRepository();
	return new RecipeImageService(
		recipes,
		new InMemoryRecipeImportRepository(recipes),
		images,
		new FixedActorProvider(actor),
		new ImageFolders('production')
	);
}

function logLines(spy: MockInstance<(...args: unknown[]) => void>): unknown[] {
	return spy.mock.calls.map(([line]) => JSON.parse(String(line)));
}

function daysAgo(days: number): Date {
	return new Date(Date.now() - days * dayInMilliseconds);
}

// Images stored two days ago: this environment's, which a recipe lists, a draft awaiting review names,
// or nothing names, and the seed's and production's beside them. The sweep runs with no actor.
async function createSweep(environment = 'development') {
	const sweepFolders = new ImageFolders(environment);
	const recipes = new InMemoryRecipeRepository();
	const imports = new InMemoryRecipeImportRepository(recipes);
	const images = new InMemoryImageStore(sweepFolders);
	const listed: RecipeImage = { role: 'dish', pathname: `dish/${environment}/listed.jpg` };
	const drafted: RecipeImage = { role: 'scan', pathname: `scan/${environment}/drafted.jpg` };
	const unused = `dish/${environment}/unused.jpg`;
	const others = ['dish/seed/soup.jpg', 'dish/production/soup.jpg'].filter(
		(pathname) => !sweepFolders.contains(pathname)
	);
	for (const pathname of [listed.pathname, drafted.pathname, unused, ...others]) {
		await images.put(pathname, jpeg, 'image/jpeg');
		images.backdateUpload(pathname, daysAgo(2));
	}

	const { memberId } = memberActor();
	await recipes.create({
		content: recipeContentSchema.parse({ ...sampleChickenSoup, images: [listed] }),
		provenance: { entryMode: 'manual' },
		contributorId: memberId,
		slugBase: 'chicken-soup',
	});
	const started = await imports.start({ memberId, mode: 'photo' });
	if (started === null) {
		throw new Error('The import was refused');
	}
	await imports.recordSuccess(started.id, {
		draft: { content: { title: 'Soup card', images: [drafted] }, problems: [] },
	});

	const service = new RecipeImageService(
		recipes,
		imports,
		images,
		new FixedActorProvider(anonymousActor()),
		sweepFolders
	);
	return { images, service, listed: listed.pathname, drafted: drafted.pathname, unused, others };
}

async function removedPathnames(images: InMemoryImageStore): Promise<string[]> {
	return (await images.listRemoved()).map(({ pathname }) => pathname);
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

	it.each([
		scan,
		'menus/soup.jpg',
		'dish/../scan/soup-card.jpg',
		'dish/preview/feature-x/soup.jpg',
		'dish/soup.jpg',
	])('refuses %s without reading the store', async (pathname) => {
		const images = await storeWithSoup();
		const { service } = serviceFor(images, anonymousActor());

		expect(await service.getPublicImage(pathname)).toBeNull();
		expect(images.wasRead).toBe(false);
	});

	it("refuses another environment's photo, though stored, without reading the store", async () => {
		const images = await storeWithSoup();
		await images.put('dish/preview/feature-x/soup.jpg', jpeg, 'image/jpeg');
		const productionImages = new InMemoryImageStore(new ImageFolders('production'));
		await productionImages.put(dishPhoto, jpeg, 'image/jpeg');
		const { service } = serviceFor(images, anonymousActor());
		const production = productionServiceFor(productionImages, anonymousActor());

		expect(await service.getPublicImage('dish/preview/feature-x/soup.jpg')).toBeNull();
		expect(await production.getPublicImage(dishPhoto)).toBeNull();
		expect(images.wasRead).toBe(false);
		expect(productionImages.wasRead).toBe(false);
	});

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

	it.each([
		dishPhoto,
		'menus/soup-card.jpg',
		'scan/../dish/seed/soup.jpg',
		'scan/%2e%2e/dish',
		'scan/preview/feature-x/soup-card.jpg',
		'scan/soup-card.jpg',
	])('refuses %s to a member without reading the store', async (pathname) => {
		const images = await storeWithSoup();
		const { service } = serviceFor(images, memberActor());

		expect(await service.getMemberImage(pathname)).toBeNull();
		expect(images.wasRead).toBe(false);
	});

	it('refuses a stored scan that is not an image type', async () => {
		const images = await storeWithSoup();
		await images.put('scan/development/card.pdf', jpeg, 'application/pdf');
		const { service } = serviceFor(images, memberActor());

		expect(await service.getMemberImage('scan/development/card.pdf')).toBeNull();
		expect(consoleWarn).toHaveBeenCalledOnce();
	});

	it('returns null for a scan the store does not have', async () => {
		const { service } = serviceFor(await storeWithSoup(), memberActor());

		expect(await service.getMemberImage('scan/development/biscuit-card.jpg')).toBeNull();
	});

	it('serves production only its own scans', async () => {
		const images = new InMemoryImageStore(new ImageFolders('production'));
		await images.put(scan, jpeg, 'image/jpeg');
		await images.put('scan/development/card.jpg', jpeg, 'image/jpeg');
		const production = productionServiceFor(images, memberActor());

		expect(await bytes((await production.getMemberImage(scan))?.body)).toEqual(jpeg);
		expect(await production.getMemberImage('scan/development/card.jpg')).toBeNull();
	});
});

describe('uploadFolders', () => {
	it("names this environment's folder for each role", () => {
		const { service } = serviceFor(new InMemoryImageStore(folders), memberActor());

		expect(service.uploadFolders()).toEqual({
			dish: 'dish/development/',
			scan: 'scan/development/',
		});
	});
});

describe('authorizeUpload', () => {
	it('refuses an anonymous visitor', async () => {
		const { service } = serviceFor(new InMemoryImageStore(folders), anonymousActor());

		await expect(service.authorizeUpload(upload)).rejects.toThrow(SignInRequiredError);
		expect(consoleInfo).not.toHaveBeenCalled();
	});

	it.each([upload, scanUpload])(
		'lets a member upload one JPEG of up to 8 MB to %s, and logs it',
		async (pathname) => {
			const member = memberActor();
			const { service } = serviceFor(new InMemoryImageStore(folders), member);

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
		const { service } = serviceFor(new InMemoryImageStore(folders), memberActor());

		await expect(service.authorizeUpload(pathname)).rejects.toThrow(InvalidImageUploadError);
		expect(consoleInfo).not.toHaveBeenCalled();
		expect(consoleWarn).toHaveBeenCalledOnce();
	});

	it('refuses the pathname of a stored image, which a removal could free while the grant lasts', async () => {
		const images = new InMemoryImageStore(folders);
		await images.put(upload, new Uint8Array([1]), 'image/jpeg');
		const { service } = serviceFor(images, memberActor());

		await expect(service.authorizeUpload(upload)).rejects.toThrow(InvalidImageUploadError);
		expect(consoleWarn).toHaveBeenCalledOnce();
	});

	it('refuses the pathname of a removed image, which a restore could bring back', async () => {
		const images = new InMemoryImageStore(folders);
		await images.put(upload, new Uint8Array([1]), 'image/jpeg');
		await images.remove([upload]);
		const { service } = serviceFor(images, memberActor());

		await expect(service.authorizeUpload(upload)).rejects.toThrow(InvalidImageUploadError);
		expect(consoleWarn).toHaveBeenCalledOnce();
	});
});

describe('sweepImages', () => {
	it("removes this environment's uploads that nothing has named for a day, and nothing else", async () => {
		const { images, service, listed, drafted, unused, others } = await createSweep();
		const fresh = 'dish/development/fresh.jpg';
		await images.put(fresh, jpeg, 'image/jpeg');

		expect(await service.sweepImages()).toEqual({
			restoredCount: 0,
			deletedCount: 0,
			removedCount: 1,
		});
		expect(images.removedPathnames).toEqual([unused]);
		for (const pathname of [listed, drafted, fresh, ...others]) {
			expect(await images.has(pathname)).toBe(true);
		}
	});

	it('brings back removed images that a recipe or draft names again, as after a database restore', async () => {
		const { images, service, listed, drafted } = await createSweep();
		await images.remove([listed, drafted]);

		expect(await service.sweepImages()).toMatchObject({ restoredCount: 2 });
		expect(await images.has(listed)).toBe(true);
		expect(await images.has(drafted)).toBe(true);
		expect(await removedPathnames(images)).not.toContain(listed);
		expect(await removedPathnames(images)).not.toContain(drafted);
	});

	it('deletes for good images removed more than 40 days ago, and keeps those removed since', async () => {
		const { images, service, unused } = await createSweep();
		const recentlyRemoved = 'scan/development/recently-removed.jpg';
		await images.put(recentlyRemoved, jpeg, 'image/jpeg');
		await images.remove([unused, recentlyRemoved]);
		images.backdateRemoval(unused, daysAgo(41));
		images.backdateRemoval(recentlyRemoved, daysAgo(39));

		expect(await service.sweepImages()).toMatchObject({ deletedCount: 1 });
		expect(await removedPathnames(images)).toEqual([recentlyRemoved]);
	});

	it('brings back an image something names however long ago it was removed', async () => {
		const { images, service, listed } = await createSweep();
		await images.remove([listed]);
		images.backdateRemoval(listed, daysAgo(41));

		expect(await service.sweepImages()).toMatchObject({ restoredCount: 1, deletedCount: 0 });
		expect(await images.has(listed)).toBe(true);
	});

	it('logs what it restored, deleted, and removed in one line', async () => {
		const { images, service, listed, unused } = await createSweep();
		const longRemoved = 'scan/development/long-removed.jpg';
		await images.put(longRemoved, jpeg, 'image/jpeg');
		await images.remove([listed, longRemoved]);
		images.backdateRemoval(longRemoved, daysAgo(41));

		await service.sweepImages();

		expect(logLines(consoleInfo)).toEqual([
			{
				level: 'info',
				logger: 'images',
				message: 'Images swept',
				restoredCount: 1,
				deletedCount: 1,
				removedCount: 1,
				restoredPathnames: [listed],
				deletedPathnames: [longRemoved],
				removedPathnames: [unused],
			},
		]);
	});

	it('logs a step that fails and carries on with the others, leaving it for the next sweep', async () => {
		const { images, service, listed, unused } = await createSweep();
		await images.remove([listed]);
		images.failRemoves();

		expect(await service.sweepImages()).toEqual({
			restoredCount: 1,
			deletedCount: 0,
			removedCount: 0,
		});
		expect(await images.has(unused)).toBe(true);
		expect(logLines(consoleWarn)).toEqual([
			expect.objectContaining({
				level: 'warn',
				message: 'Image sweep step failed',
				step: 'remove',
				pathnames: [unused],
				err: expect.objectContaining({ message: 'The image store could not be reached' }),
			}),
		]);
	});
});

describe('deletePreviewImages', () => {
	it("deletes every image in a preview's folders for good, removed ones included", async () => {
		const { images, service, listed, unused, others } = await createSweep(
			'preview/feature-x-1a2b3c4d'
		);
		await images.remove([unused]);

		expect(await service.deletePreviewImages()).toEqual({ deletedCount: 3 });
		expect(await images.has(listed)).toBe(false);
		expect(await removedPathnames(images)).toEqual([]);
		for (const pathname of others) {
			expect(await images.has(pathname)).toBe(true);
		}
		expect(logLines(consoleInfo)).toEqual([
			{ level: 'info', logger: 'images', message: 'Preview images deleted', deletedCount: 3 },
		]);
	});

	it.each(['production', 'development'])(
		'refuses %s, whose folders outlive any one deployment',
		async (environment) => {
			const { images, service, listed } = await createSweep(environment);

			await expect(service.deletePreviewImages()).rejects.toThrow(
				"Only a preview's images are ever deleted together"
			);
			expect(await images.has(listed)).toBe(true);
		}
	);
});
