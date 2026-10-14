import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { SignInRequiredError } from '@/application/authorization';
import type { Actor } from '@/application/ports/actor-provider';
import type { TaskScheduler } from '@/application/ports/task-scheduler';
import { InvalidImageUploadError } from '@/application/recipes/errors';
import { ImageFolders } from '@/application/recipes/image-folders';
import type { ImageSweepCounts } from '@/application/recipes/recipe-dtos';
import { RecipeImageService } from '@/application/recipes/recipe-image-service';
import { anonymousActor, memberActor } from '@/application/testing/actors';
import { FixedActorProvider } from '@/application/testing/fixed-actor-provider';
import { InMemoryImageMoveLock } from '@/application/testing/in-memory-image-move-lock';
import { InMemoryImageStore } from '@/application/testing/in-memory-image-store';
import { InMemoryRecipeImportRepository } from '@/application/testing/in-memory-recipe-import-repository';
import { InMemoryRecipeRepository } from '@/application/testing/in-memory-recipe-repository';
import { recipeContentSchema, recipeIdSchema } from '@/domain/recipe/recipe';
import type { RecipeImage } from '@/domain/recipe/recipe-image';
import { sampleChickenSoup } from '@/domain/recipe/samples/sample-recipes';
import { daysInMilliseconds } from '@/lib/dates';
import { settings } from '@/lib/settings';

const dishPhoto = 'dish/seed/soup.jpg';
const scan = 'scan/production/soup-card.jpg';
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
const upload = 'dish/development/3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b.jpg';
const scanUpload = 'scan/development/0b6e2f4a-9c1d-4e8b-a7f3-5d2c1b0a9e8f.jpg';
// A deployment that, like a preview, also reads production's and the seed's images.
const folders = new ImageFolders('development', ['production', 'seed']);
// How long the test lock lets a removal wait before it gives up.
const moveLockWaitMs = 10_000;

let consoleInfo: MockInstance<typeof console.info>;
let consoleWarn: MockInstance<typeof console.warn>;
let consoleError: MockInstance<typeof console.error>;

beforeEach(() => {
	// Keeps log lines out of the test output; the tests that check logging read them here.
	consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => {});
	consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
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

// Tasks are held until a test runs them, as after() holds them until the response is sent.
function heldTasks() {
	const tasks: (() => Promise<void>)[] = [];
	const scheduleTask: TaskScheduler = (task) => {
		tasks.push(task);
	};
	return { tasks, scheduleTask };
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
			folders,
			new InMemoryImageMoveLock(),
			heldTasks().scheduleTask
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
		new ImageFolders('production'),
		new InMemoryImageMoveLock(),
		heldTasks().scheduleTask
	);
}

function logLines(spy: MockInstance<(...args: unknown[]) => void>): unknown[] {
	return spy.mock.calls.map(([line]) => JSON.parse(String(line)));
}

function daysAgo(days: number): Date {
	return new Date(Date.now() - daysInMilliseconds(days));
}

// A day past a lifetime in days, and a day within it.
function pastLifetime(days: number): Date {
	return daysAgo(days + 1);
}

function withinLifetime(days: number): Date {
	return daysAgo(days - 1);
}

// Images stored past an unused upload's lifetime: this environment's, which a recipe lists, a draft
// awaiting review names, or nothing names, and the seed's and production's beside them. The sweep runs
// with no actor.
async function createSweep(environment = 'development', expiringPrefixes: string[] = []) {
	const sweepFolders = new ImageFolders(environment, [], expiringPrefixes);
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
		images.backdateUpload(pathname, pastLifetime(settings.retention.unusedImageLifetimeDays));
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

	const lock = new InMemoryImageMoveLock(moveLockWaitMs);
	const { tasks, scheduleTask } = heldTasks();
	const service = new RecipeImageService(
		recipes,
		imports,
		images,
		new FixedActorProvider(anonymousActor()),
		sweepFolders,
		lock,
		scheduleTask
	);
	return {
		images,
		recipes,
		lock,
		tasks,
		service,
		listed: listed.pathname,
		drafted: drafted.pathname,
		unused,
		others,
	};
}

// Saves a recipe naming the image, as a member's save would.
async function attach(recipes: InMemoryRecipeRepository, image: RecipeImage) {
	await recipes.create({
		content: recipeContentSchema.parse({ ...sampleChickenSoup, images: [image] }),
		provenance: { entryMode: 'manual' },
		contributorId: memberActor().memberId,
		slugBase: 'saved-soup',
	});
}

// A sweep that ran, with every count it does not name at zero.
function sweptCounts(counts: Partial<ImageSweepCounts>) {
	return {
		status: 'ran',
		result: { restoredCount: 0, deletedCount: 0, removedCount: 0, expiredCount: 0, ...counts },
	};
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

		expect(await service.sweepImages()).toEqual(sweptCounts({ removedCount: 1 }));
		expect(images.removedPathnames).toEqual([unused]);
		for (const pathname of [listed, drafted, fresh, ...others]) {
			expect(await images.has(pathname)).toBe(true);
		}
	});

	it('brings back removed images that a recipe or draft names again, as after a database restore', async () => {
		const { images, service, listed, drafted } = await createSweep();
		await images.remove([listed, drafted]);

		expect(await service.sweepImages()).toMatchObject({ result: { restoredCount: 2 } });
		expect(await images.has(listed)).toBe(true);
		expect(await images.has(drafted)).toBe(true);
		expect(await removedPathnames(images)).not.toContain(listed);
		expect(await removedPathnames(images)).not.toContain(drafted);
	});

	it('deletes for good images removed longer ago than their lifetime, and keeps the rest', async () => {
		const { images, service, unused } = await createSweep();
		const recentlyRemoved = 'scan/development/recently-removed.jpg';
		await images.put(recentlyRemoved, jpeg, 'image/jpeg');
		await images.remove([unused, recentlyRemoved]);
		images.backdateRemoval(unused, pastLifetime(settings.retention.removedImageLifetimeDays));
		images.backdateRemoval(
			recentlyRemoved,
			withinLifetime(settings.retention.removedImageLifetimeDays)
		);

		expect(await service.sweepImages()).toMatchObject({ result: { deletedCount: 1 } });
		expect(await removedPathnames(images)).toEqual([recentlyRemoved]);
	});

	it('brings back an image something names however long ago it was removed', async () => {
		const { images, service, listed } = await createSweep();
		await images.remove([listed]);
		images.backdateRemoval(listed, pastLifetime(settings.retention.removedImageLifetimeDays));

		expect(await service.sweepImages()).toMatchObject({
			result: { restoredCount: 1, deletedCount: 0 },
		});
		expect(await images.has(listed)).toBe(true);
	});

	it('brings back an image one sweep removed while a save attached it, at the next sweep', async () => {
		const { images, recipes, service, unused } = await createSweep();
		// The save lands after the sweep found the upload unused and before it removes it.
		const remove = images.remove.bind(images);
		vi.spyOn(images, 'remove').mockImplementationOnce(async (pathnames) => {
			await attach(recipes, { role: 'dish', pathname: unused });
			await remove(pathnames);
		});

		expect(await service.sweepImages()).toEqual(sweptCounts({ removedCount: 1 }));
		expect(await images.has(unused)).toBe(false);

		expect(await service.sweepImages()).toEqual(sweptCounts({ restoredCount: 1 }));
		expect(await images.has(unused)).toBe(true);
		expect(await removedPathnames(images)).toEqual([]);
	});

	it('logs what it restored, deleted, removed, and expired in one line', async () => {
		const { images, service, listed, unused } = await createSweep();
		const longRemoved = 'scan/development/long-removed.jpg';
		await images.put(longRemoved, jpeg, 'image/jpeg');
		await images.remove([listed, longRemoved]);
		images.backdateRemoval(longRemoved, pastLifetime(settings.retention.removedImageLifetimeDays));

		await service.sweepImages();

		expect(logLines(consoleInfo)).toEqual([
			{
				level: 'info',
				logger: 'images',
				message: 'Images swept',
				restoredCount: 1,
				deletedCount: 1,
				removedCount: 1,
				expiredCount: 0,
				restoredPathnames: [listed],
				deletedPathnames: [longRemoved],
				removedPathnames: [unused],
				expiredPathnames: [],
			},
		]);
	});

	it('logs a step that fails and carries on with the others, leaving it for the next sweep', async () => {
		const { images, service, listed, unused } = await createSweep();
		await images.remove([listed]);
		images.failRemoves();

		expect(await service.sweepImages()).toEqual(sweptCounts({ restoredCount: 1 }));
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

	it('skips a sweep started while another holds the lock, and logs that it skipped', async () => {
		const { images, service, unused } = await createSweep();

		const [first, second] = await Promise.all([service.sweepImages(), service.sweepImages()]);

		expect(first).toEqual(sweptCounts({ removedCount: 1 }));
		expect(second).toEqual({ status: 'skipped' });
		expect(images.removedPathnames).toEqual([unused]);
		expect(logLines(consoleInfo)).toEqual([
			{
				level: 'info',
				logger: 'images',
				message: 'Image sweep skipped while another image move runs',
			},
			expect.objectContaining({ message: 'Images swept' }),
		]);
	});

	it('releases the lock when a sweep throws, so the next one runs', async () => {
		const { images, lock, service, unused } = await createSweep();
		vi.spyOn(images, 'listRemoved').mockRejectedValueOnce(new Error('Blob is unreachable'));

		await expect(service.sweepImages()).rejects.toThrow('Blob is unreachable');
		expect(lock.isHeld).toBe(false);
		expect(await service.sweepImages()).toEqual(sweptCounts({ removedCount: 1 }));
		expect(images.removedPathnames).toEqual([unused]);
	});
});

describe('sweepImages expiring other environments', () => {
	const previewImages = {
		old: 'dish/preview/feature-x-1a2b3c4d/old.jpg',
		oldScan: 'scan/preview/feature-y-5e6f7a8b/old-card.jpg',
		oldRemoved: 'dish/preview/feature-x-1a2b3c4d/old-removed.jpg',
		recent: 'dish/preview/feature-x-1a2b3c4d/recent.jpg',
		recentRemoved: 'scan/preview/feature-x-1a2b3c4d/recent-removed.jpg',
	};

	// Previews' images in the one store: some stored or removed longer ago than their lifetime, others
	// since.
	// A preview removes its own, through its own view of the store.
	async function storePreviewImages(images: InMemoryImageStore) {
		for (const pathname of Object.values(previewImages)) {
			await images.put(pathname, jpeg, 'image/jpeg');
		}
		await images
			.viewAs(new ImageFolders('preview/feature-x-1a2b3c4d'))
			.remove([previewImages.oldRemoved, previewImages.recentRemoved]);
		const expired = pastLifetime(settings.retention.expiringImageLifetimeDays);
		const recent = withinLifetime(settings.retention.expiringImageLifetimeDays);
		images.backdateUpload(previewImages.old, expired);
		images.backdateUpload(previewImages.oldScan, expired);
		images.backdateRemoval(previewImages.oldRemoved, expired);
		images.backdateUpload(previewImages.recent, recent);
		images.backdateRemoval(previewImages.recentRemoved, recent);
	}

	it("deletes production's expired preview images, removed ones included, and keeps the rest", async () => {
		const { images, service, listed, drafted, unused, others } = await createSweep('production', [
			'preview/',
		]);
		await storePreviewImages(images);

		expect(await service.sweepImages()).toEqual(sweptCounts({ removedCount: 1, expiredCount: 3 }));
		expect(await images.has(previewImages.old)).toBe(false);
		expect(await images.has(previewImages.oldScan)).toBe(false);
		expect(await images.hasRemoved(previewImages.oldRemoved)).toBe(false);
		expect(await images.has(previewImages.recent)).toBe(true);
		expect(await images.hasRemoved(previewImages.recentRemoved)).toBe(true);
		for (const pathname of [listed, drafted, ...others]) {
			expect(await images.has(pathname)).toBe(true);
		}
		expect(await images.hasRemoved(unused)).toBe(true);
		expect(logLines(consoleInfo)).toEqual([
			expect.objectContaining({
				message: 'Images swept',
				expiredCount: 3,
				expiredPathnames: [previewImages.old, previewImages.oldScan, previewImages.oldRemoved],
			}),
		]);
	});

	it("never expires another environment's images where nothing expires", async () => {
		const { images, service } = await createSweep('preview/feature-z-9c8d7e6f');
		await storePreviewImages(images);

		expect(await service.sweepImages()).toMatchObject({ result: { expiredCount: 0 } });
		expect(await images.has(previewImages.old)).toBe(true);
		expect(await images.hasRemoved(previewImages.oldRemoved)).toBe(true);
	});

	it('logs an expiry that fails and carries on, leaving it for the next sweep', async () => {
		const { images, service } = await createSweep('production', ['preview/']);
		await storePreviewImages(images);
		vi.spyOn(images, 'deleteExpired').mockRejectedValueOnce(new Error('Blob is unreachable'));

		expect(await service.sweepImages()).toEqual(sweptCounts({ removedCount: 1 }));
		expect(logLines(consoleWarn)).toEqual([
			expect.objectContaining({
				message: 'Image sweep step failed',
				step: 'expire',
				err: expect.objectContaining({ message: 'Blob is unreachable' }),
			}),
		]);
		expect(await service.sweepImages()).toMatchObject({ result: { expiredCount: 3 } });
	});
});

describe('scheduleSweep', () => {
	it('schedules one sweep, which runs only when the scheduler runs it', async () => {
		const { images, service, tasks, unused } = await createSweep();

		service.scheduleSweep();

		expect(tasks).toHaveLength(1);
		expect(await images.has(unused)).toBe(true);
		await tasks[0]?.();
		expect(await images.has(unused)).toBe(false);
		expect(logLines(consoleInfo)).toEqual([expect.objectContaining({ message: 'Images swept' })]);
	});

	it('logs a sweep that fails rather than letting it escape the scheduled task', async () => {
		const { images, service, tasks } = await createSweep();
		vi.spyOn(images, 'listRemoved').mockRejectedValueOnce(new Error('Blob is unreachable'));

		service.scheduleSweep();

		await expect(tasks[0]?.()).resolves.toBeUndefined();
		expect(logLines(consoleError)).toEqual([
			expect.objectContaining({
				level: 'error',
				logger: 'images',
				message: 'Image sweep failed',
				err: expect.objectContaining({ message: 'Blob is unreachable' }),
			}),
		]);
	});
});

describe('scheduleSweep with the images an edit or delete let go', () => {
	// The recipe the write let them go from, which their log lines name.
	const recipeId = recipeIdSchema.parse('0199c7a4-2c3e-7b1a-9f00-2a7c1e4b5d6e');
	const released = 'dish/development/released.jpg';
	const releasedImage: RecipeImage = { role: 'dish', pathname: released };

	afterEach(() => {
		vi.useRealTimers();
	});

	// The sweep's images, and an upload made just now that nothing names: a sweep leaves it for a day,
	// so only a removal removes it.
	async function createRemoval() {
		const sweep = await createSweep();
		await sweep.images.put(released, jpeg, 'image/jpeg');
		return sweep;
	}

	// Another image move, which holds the lock until the returned function ends it.
	function moveHolding(lock: InMemoryImageMoveLock): () => Promise<void> {
		const move = Promise.withResolvers<void>();
		const moving = lock.tryRun(() => move.promise);
		return async () => {
			move.resolve();
			await moving;
		};
	}

	it('removes those nothing names once the scheduler runs it, then sweeps', async () => {
		const { images, service, tasks, unused } = await createRemoval();

		service.scheduleSweep({ recipeId, images: [releasedImage] });

		expect(tasks).toHaveLength(1);
		expect(await images.has(released)).toBe(true);
		await tasks[0]?.();
		expect(await images.hasRemoved(released)).toBe(true);
		expect(images.removedPathnames).toEqual([released, unused]);
		expect(logLines(consoleInfo)).toEqual([
			{
				level: 'info',
				logger: 'images',
				message: 'Recipe images removed',
				recipeId,
				pathnames: [released],
			},
			expect.objectContaining({ message: 'Images swept', removedPathnames: [unused] }),
		]);
	});

	it("keeps those a recipe lists or a draft awaiting review names, logged as kept, and other environments'", async () => {
		const { images, service, tasks, listed, drafted, others } = await createRemoval();
		const othersImages: RecipeImage[] = others.map((pathname) => ({ role: 'dish', pathname }));

		service.scheduleSweep({
			recipeId,
			images: [
				{ role: 'dish', pathname: listed },
				{ role: 'scan', pathname: drafted },
				...othersImages,
				releasedImage,
			],
		});
		await tasks[0]?.();

		for (const pathname of [listed, drafted, ...others]) {
			expect(await images.has(pathname)).toBe(true);
		}
		expect(images.removedPathnames).not.toContain(listed);
		expect(images.removedPathnames).not.toContain(drafted);
		expect(logLines(consoleInfo)).toContainEqual({
			level: 'info',
			logger: 'images',
			message: 'Recipe images removed',
			recipeId,
			pathnames: [released],
			keptPathnames: [listed, drafted],
		});
	});

	it('waits for another move that holds the lock, then removes them and sweeps', async () => {
		const { images, lock, service, tasks, unused } = await createRemoval();
		const endMove = moveHolding(lock);

		service.scheduleSweep({ recipeId, images: [releasedImage] });
		const running = tasks[0]?.();
		await vi.waitFor(() => expect(lock.waitingCount).toBe(1));
		expect(images.removedPathnames).toEqual([]);
		await endMove();
		await running;

		expect(images.removedPathnames).toEqual([released, unused]);
	});

	it('checks which are in use only once it holds the lock, so an image saved meanwhile is kept', async () => {
		const { images, lock, recipes, service, tasks } = await createRemoval();
		const endMove = moveHolding(lock);

		service.scheduleSweep({ recipeId, images: [releasedImage] });
		const running = tasks[0]?.();
		await vi.waitFor(() => expect(lock.waitingCount).toBe(1));
		await attach(recipes, releasedImage);
		await endMove();
		await running;

		expect(await images.has(released)).toBe(true);
		expect(images.removedPathnames).not.toContain(released);
	});

	it('removes them and sweeps in one hold, so no other move runs in between', async () => {
		const { images, lock, service, tasks } = await createRemoval();
		const moves: string[] = [];
		let otherMove: Promise<void> | undefined;
		const remove = images.remove.bind(images);
		vi.spyOn(images, 'remove').mockImplementationOnce(async (pathnames) => {
			// Another move asks for the lock while the removal runs.
			otherMove = lock.run(async () => {
				moves.push('other move');
			});
			await remove(pathnames);
			moves.push('removal');
		});
		const listRemoved = images.listRemoved.bind(images);
		vi.spyOn(images, 'listRemoved').mockImplementation(async () => {
			moves.push('sweep');
			return listRemoved();
		});

		service.scheduleSweep({ recipeId, images: [releasedImage] });
		await tasks[0]?.();
		await otherMove;

		expect(moves).toEqual(['removal', 'sweep', 'other move']);
	});

	it('leaves them for a later sweep and logs a warning when the lock stays held past its wait', async () => {
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
		const { images, lock, service, tasks } = await createRemoval();
		moveHolding(lock);

		service.scheduleSweep({ recipeId, images: [releasedImage] });
		const running = tasks[0]?.();
		await vi.advanceTimersByTimeAsync(moveLockWaitMs);

		await expect(running).resolves.toBeUndefined();
		expect(await images.has(released)).toBe(true);
		expect(images.removedPathnames).toEqual([]);
		expect(logLines(consoleWarn)).toEqual([
			expect.objectContaining({
				level: 'warn',
				logger: 'images',
				message: 'Recipe images could not be removed',
				recipeId,
				pathnames: [released],
				err: expect.objectContaining({ message: 'Timed out waiting for the image move lock' }),
			}),
		]);
		expect(consoleError).not.toHaveBeenCalled();
	});

	it('logs a removal that fails and carries on with the sweep, leaving them for a later one', async () => {
		const { images, service, tasks, unused } = await createRemoval();
		vi.spyOn(images, 'remove').mockRejectedValueOnce(new Error('Blob is unreachable'));

		service.scheduleSweep({ recipeId, images: [releasedImage] });
		await tasks[0]?.();

		expect(await images.has(released)).toBe(true);
		expect(await images.hasRemoved(unused)).toBe(true);
		expect(logLines(consoleWarn)).toEqual([
			expect.objectContaining({
				level: 'warn',
				logger: 'images',
				message: 'Recipe images could not be removed',
				recipeId,
				pathnames: [released],
				err: expect.objectContaining({ message: 'Blob is unreachable' }),
			}),
		]);
		expect(logLines(consoleInfo)).toEqual([
			expect.objectContaining({ message: 'Images swept', removedCount: 1 }),
		]);
	});

	it('logs a sweep that fails after the removal as a failed sweep, and releases the lock', async () => {
		const { images, lock, service, tasks } = await createRemoval();
		vi.spyOn(images, 'listRemoved').mockRejectedValueOnce(new Error('Blob is unreachable'));

		service.scheduleSweep({ recipeId, images: [releasedImage] });

		await expect(tasks[0]?.()).resolves.toBeUndefined();
		expect(images.removedPathnames).toEqual([released]);
		expect(lock.isHeld).toBe(false);
		expect(consoleWarn).not.toHaveBeenCalled();
		expect(logLines(consoleError)).toEqual([
			expect.objectContaining({
				level: 'error',
				logger: 'images',
				message: 'Image sweep failed',
				err: expect.objectContaining({ message: 'Blob is unreachable' }),
			}),
		]);
	});

	it.each<[string, RecipeImage[]]>([
		['no images', []],
		[
			"only other environments' images",
			[
				{ role: 'dish', pathname: 'dish/seed/soup.jpg' },
				{ role: 'dish', pathname: 'dish/production/soup.jpg' },
			],
		],
	])(
		'sweeps without waiting, so skips while another move runs, when given %s',
		async (_case, releasedImages) => {
			const { images, lock, service, tasks } = await createRemoval();
			const endMove = moveHolding(lock);

			service.scheduleSweep({ recipeId, images: releasedImages });
			await tasks[0]?.();

			expect(lock.waitingCount).toBe(0);
			expect(images.removedPathnames).toEqual([]);
			expect(logLines(consoleInfo)).toEqual([
				{
					level: 'info',
					logger: 'images',
					message: 'Image sweep skipped while another image move runs',
				},
			]);
			await endMove();
		}
	);
});
