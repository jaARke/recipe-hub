import type { IncomingHttpHeaders } from 'node:http';
import { get as getBlob, type GetBlobResult } from '@vercel/blob';
import { dangerouslyDeleteBySrcImage, dangerouslyDeleteByTag } from '@vercel/functions';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { ImageMoveInterruptedError } from '@/application/ports/image-store';
import { ImageFolders } from '@/application/recipes/image-folders';
import { RecipeImageService } from '@/application/recipes/recipe-image-service';
import { anonymousActor } from '@/application/testing/actors';
import { FixedActorProvider } from '@/application/testing/fixed-actor-provider';
import { InMemoryImageMoveLock } from '@/application/testing/in-memory-image-move-lock';
import { InMemoryProductionImages } from '@/application/testing/in-memory-production-images';
import { InMemoryRecipeImportRepository } from '@/application/testing/in-memory-recipe-import-repository';
import { InMemoryRecipeRepository } from '@/application/testing/in-memory-recipe-repository';
import { InMemorySavedDraftRepository } from '@/application/testing/in-memory-saved-draft-repository';
import { stalledCall } from '@/application/testing/stalled-call';
import { BlobImageStore } from '@/infrastructure/storage/blob-image-store';
import { startFakeBlobApi, type FakeBlobApi } from '@/infrastructure/storage/testing/fake-blob-api';

// A read goes to the store's own host rather than Blob's API, which the fake API cannot play, so a
// test that reads stands in for the SDK's get.
vi.mock('@vercel/blob', async (importOriginal) => {
	const blob = await importOriginal<typeof import('@vercel/blob')>();
	return { ...blob, get: vi.fn(blob.get) };
});

// Outside a Vercel request the purges do nothing, so tests see what the store asks of them.
vi.mock('@vercel/functions', async (importOriginal) => {
	const functions = await importOriginal<typeof import('@vercel/functions')>();
	return {
		...functions,
		dangerouslyDeleteByTag: vi.fn(functions.dangerouslyDeleteByTag),
		dangerouslyDeleteBySrcImage: vi.fn(functions.dangerouslyDeleteBySrcImage),
	};
});

type ReceivedRequest = {
	method?: string;
	path: string;
	params: Record<string, string>;
	headers: IncomingHttpHeaders;
	body?: unknown;
};

type StoredBlob = {
	uploadedAt: Date;
	// The cache lifetime the copy that made it asked for, when one did.
	cacheControlMaxAge?: string;
};

const yearInSeconds = 365 * 24 * 60 * 60;
// Small, so a folder of a few blobs takes several pages.
const pageSize = 2;
const longAgo = new Date('2026-08-01T00:00:00Z');
const cutoff = new Date('2026-10-12T00:00:00Z');
const recently = new Date('2026-10-12T12:00:00Z');

let blobApi: FakeBlobApi;
let blobs: Map<string, StoredBlob>;
let received: ReceivedRequest[];
// While set, the fake API never answers, and counts the requests it holds and those the client gives
// up on.
let stalled: boolean;
let unansweredCount: number;
let abandonedCount: number;

function storeFor(environment: string): BlobImageStore {
	return new BlobImageStore({ storeId: 'store_test', folders: new ImageFolders(environment) });
}

function store(pathnames: readonly string[], uploadedAt: Date = longAgo): void {
	for (const pathname of pathnames) {
		blobs.set(pathname, { uploadedAt });
	}
}

// Blob's API lists by prefix a page at a time, copies, and deletes. Copying a pathname whose name
// says so fails, or never answers.
beforeEach(async () => {
	blobs = new Map();
	received = [];
	stalled = false;
	unansweredCount = 0;
	abandonedCount = 0;
	blobApi = await startFakeBlobApi((request, body, response) => {
		const url = new URL(request.url ?? '/', 'http://127.0.0.1');
		if (stalled || url.searchParams.get('fromUrl')?.includes('stalling')) {
			unansweredCount += 1;
			response.on('close', () => {
				abandonedCount += 1;
			});
			return;
		}

		const params = Object.fromEntries(url.searchParams);
		received.push({
			method: request.method,
			path: url.pathname,
			params,
			headers: request.headers,
			...(body !== '' && { body: JSON.parse(body) }),
		});
		const answer = (status: number, value: object) => {
			response.writeHead(status, { 'content-type': 'application/json' });
			response.end(JSON.stringify(value));
		};

		if (request.method === 'GET' && params.prefix !== undefined) {
			const listed = [...blobs.keys()]
				.filter((pathname) => pathname.startsWith(params.prefix!))
				.sort();
			const start = Number(params.cursor ?? 0);
			const hasMore = start + pageSize < listed.length;
			answer(200, {
				blobs: listed.slice(start, start + pageSize).map((pathname) => ({
					url: `https://test.private.blob.vercel-storage.com/${pathname}`,
					downloadUrl: `https://test.private.blob.vercel-storage.com/${pathname}?download=1`,
					pathname,
					size: 4,
					uploadedAt: blobs.get(pathname)?.uploadedAt.toISOString(),
					etag: '"etag"',
				})),
				hasMore,
				...(hasMore && { cursor: String(start + pageSize) }),
			});
		} else if (request.method === 'PUT' && params.fromUrl !== undefined) {
			const { pathname, fromUrl } = params;
			if (fromUrl.includes('unreadable')) {
				answer(400, { error: { code: 'bad_request', message: 'The copy failed' } });
			} else if (!blobs.has(fromUrl)) {
				answer(404, { error: { code: 'not_found', message: 'The blob does not exist' } });
			} else {
				blobs.set(pathname!, {
					uploadedAt: new Date(),
					cacheControlMaxAge: String(request.headers['x-cache-control-max-age']),
				});
				answer(200, {
					url: `https://test.private.blob.vercel-storage.com/${pathname}`,
					downloadUrl: `https://test.private.blob.vercel-storage.com/${pathname}?download=1`,
					pathname,
					contentType: 'image/jpeg',
					contentDisposition: 'inline',
					etag: '"etag"',
				});
			}
		} else if (request.method === 'POST' && url.pathname === '/delete') {
			for (const pathname of (JSON.parse(body) as { urls: string[] }).urls) {
				blobs.delete(pathname);
			}
			answer(200, {});
		} else {
			answer(404, { error: { code: 'not_found', message: 'No such endpoint' } });
		}
	});
});

afterEach(async () => {
	await blobApi.close();
	vi.mocked(dangerouslyDeleteByTag).mockClear();
	vi.mocked(dangerouslyDeleteBySrcImage).mockClear();
});

describe('listUploadedBefore', () => {
	it("lists this environment's folders a page at a time, and only images uploaded before the cutoff", async () => {
		store([
			'dish/production/a.jpg',
			'dish/production/b.jpg',
			'scan/production/c.jpg',
			'trash/dish/production/d.jpg',
			'dish/preview/feature-x/e.jpg',
			'dish/seed/soup.jpg',
		]);
		store(['dish/production/recent.jpg'], recently);

		expect(await storeFor('production').listUploadedBefore(cutoff)).toEqual([
			'dish/production/a.jpg',
			'dish/production/b.jpg',
			'scan/production/c.jpg',
		]);
		expect(received.map(({ params }) => params)).toEqual([
			{ prefix: 'dish/production/' },
			{ prefix: 'dish/production/', cursor: '2' },
			{ prefix: 'scan/production/' },
		]);
	});
});

describe('listRemoved', () => {
	it("names each image in this environment's trash by its pathname, removed when it was copied there", async () => {
		store(['trash/dish/production/a.jpg', 'trash/dish/development/b.jpg', 'dish/production/c.jpg']);
		store(['trash/scan/production/d.jpg'], recently);

		expect(await storeFor('production').listRemoved()).toEqual([
			{ pathname: 'dish/production/a.jpg', removedAt: longAgo },
			{ pathname: 'scan/production/d.jpg', removedAt: recently },
		]);
		expect(received.map(({ params }) => params.prefix)).toEqual([
			'trash/dish/production/',
			'trash/scan/production/',
		]);
	});
});

describe('remove', () => {
	it('moves each image into the trash under its pathname on its own, copied and then its original deleted', async () => {
		store(['dish/development/a.jpg', 'scan/development/b.jpg']);
		const before = Date.now();

		await storeFor('development').remove(['dish/development/a.jpg', 'scan/development/b.jpg']);

		expect([...blobs.keys()].sort()).toEqual([
			'trash/dish/development/a.jpg',
			'trash/scan/development/b.jpg',
		]);
		expect(blobs.get('trash/dish/development/a.jpg')?.uploadedAt.getTime()).toBeGreaterThanOrEqual(
			before
		);
		expect(received).toEqual([
			expect.objectContaining({
				method: 'PUT',
				params: { pathname: 'trash/dish/development/a.jpg', fromUrl: 'dish/development/a.jpg' },
				headers: expect.objectContaining({
					'x-vercel-blob-access': 'private',
					'x-allow-overwrite': '1',
					'x-add-random-suffix': '0',
				}),
			}),
			expect.objectContaining({
				method: 'POST',
				path: '/delete',
				body: { urls: ['dish/development/a.jpg'] },
			}),
			expect.objectContaining({
				method: 'PUT',
				params: { pathname: 'trash/scan/development/b.jpg', fromUrl: 'scan/development/b.jpg' },
			}),
			expect.objectContaining({
				method: 'POST',
				path: '/delete',
				body: { urls: ['scan/development/b.jpg'] },
			}),
		]);
	});

	it('skips an image that is already gone', async () => {
		store(['dish/development/a.jpg']);

		await storeFor('development').remove(['dish/development/gone.jpg', 'dish/development/a.jpg']);

		expect([...blobs.keys()]).toEqual(['trash/dish/development/a.jpg']);
	});

	it('leaves an image whose copy fails in place and returns it with why, and moves the rest', async () => {
		store(['dish/development/a.jpg', 'dish/development/unreadable.jpg', 'scan/development/c.jpg']);

		expect(
			await storeFor('development').remove([
				'dish/development/a.jpg',
				'dish/development/unreadable.jpg',
				'scan/development/c.jpg',
			])
		).toEqual({
			failed: [
				{
					pathname: 'dish/development/unreadable.jpg',
					reason: 'Error: Vercel Blob: The copy failed',
				},
			],
			unpurged: [],
		});
		expect([...blobs.keys()].sort()).toEqual([
			'dish/development/unreadable.jpg',
			'trash/dish/development/a.jpg',
			'trash/scan/development/c.jpg',
		]);
		expect(received.flatMap(({ body }) => (body as { urls?: string[] })?.urls ?? [])).toEqual([
			'dish/development/a.jpg',
			'scan/development/c.jpg',
		]);
	});

	it('purges 20 dish photos two calls of each kind before the move and two after, 16 a call', async () => {
		const pathnames = Array.from({ length: 20 }, (_, index) => `dish/development/${index}.jpg`);
		store(pathnames);

		await storeFor('development').remove(pathnames);

		const tags = pathnames.map((pathname) => `image:${pathname}`);
		const sources = pathnames.map((pathname) => `/api/images/${pathname}`);
		expect(vi.mocked(dangerouslyDeleteByTag).mock.calls.map(([tag]) => tag)).toEqual([
			tags.slice(0, 16),
			tags.slice(16),
			tags.slice(0, 16),
			tags.slice(16),
		]);
		expect(vi.mocked(dangerouslyDeleteBySrcImage).mock.calls.map(([source]) => source)).toEqual([
			sources.slice(0, 16),
			sources.slice(16),
			sources.slice(0, 16),
			sources.slice(16),
		]);
	});

	it('leaves the images whose purge fails before the move in place, and moves the rest', async () => {
		const pathnames = Array.from({ length: 20 }, (_, index) => `dish/development/${index}.jpg`);
		store(pathnames);
		vi.mocked(dangerouslyDeleteByTag)
			.mockResolvedValueOnce(undefined)
			.mockRejectedValueOnce(new Error('Purge refused'));

		expect(await storeFor('development').remove(pathnames)).toEqual({
			failed: pathnames.slice(16).map((pathname) => ({ pathname, reason: 'Error: Purge refused' })),
			unpurged: [],
		});
		expect(pathnames.filter((pathname) => blobs.has(pathname))).toEqual(pathnames.slice(16));
		expect(pathnames.filter((pathname) => blobs.has(`trash/${pathname}`))).toEqual(
			pathnames.slice(0, 16)
		);
	});

	it('reports a purge that fails after the move against the images it covered, which stay moved', async () => {
		store(['dish/development/a.jpg']);
		vi.mocked(dangerouslyDeleteByTag)
			.mockResolvedValueOnce(undefined)
			.mockRejectedValueOnce(new Error('Purge refused'));

		expect(await storeFor('development').remove(['dish/development/a.jpg'])).toEqual({
			failed: [],
			unpurged: [{ pathname: 'dish/development/a.jpg', reason: 'Error: Purge refused' }],
		});
		expect([...blobs.keys()]).toEqual(['trash/dish/development/a.jpg']);
	});

	it("stops at the image at hand, aborting its request, once the caller's signal aborts", async () => {
		store(['dish/development/a.jpg', 'dish/development/b.jpg']);
		stalled = true;
		const caller = new AbortController();
		const reason = new Error('The sweep ran out of time');

		const removal = storeFor('development').remove(
			['dish/development/a.jpg', 'dish/development/b.jpg'],
			caller.signal
		);
		await vi.waitFor(() => expect(unansweredCount).toBe(1));
		caller.abort(reason);

		await expect(removal).rejects.toThrow(ImageMoveInterruptedError);
		await expect(removal).rejects.toMatchObject({ cause: reason, unpurged: [] });
		await vi.waitFor(() => expect(abandonedCount).toBe(1));
		expect(unansweredCount).toBe(1);
	});

	describe('stopped part way', () => {
		const moved = 'dish/development/a.jpg';
		const stalling = 'dish/development/stalling.jpg';
		const untried = 'dish/development/b.jpg';

		// Moves the first image, then stops at a copy Blob never answers once the caller's signal aborts.
		async function removeUntilStopped(reason: Error): Promise<unknown> {
			store([moved, stalling, untried]);
			const caller = new AbortController();
			const removal = storeFor('development').remove([moved, stalling, untried], caller.signal);
			await vi.waitFor(() => expect(unansweredCount).toBe(1));
			caller.abort(reason);
			return removal.catch((error: unknown) => error);
		}

		it('still purges the image it moved, then rejects with the signal as its cause', async () => {
			const reason = new Error('The sweep ran out of time');

			const failure = await removeUntilStopped(reason);

			expect(failure).toBeInstanceOf(ImageMoveInterruptedError);
			expect(failure).toMatchObject({ cause: reason, unpurged: [] });
			const sources = (pathnames: string[]) =>
				pathnames.map((pathname) => `/api/images/${pathname}`);
			expect(vi.mocked(dangerouslyDeleteBySrcImage).mock.calls.map(([source]) => source)).toEqual([
				sources([moved, stalling, untried]),
				sources([moved]),
			]);
			expect([...blobs.keys()].sort()).toEqual([untried, stalling, `trash/${moved}`]);
		});

		it('names the image it moved whose purge then failed', async () => {
			vi.mocked(dangerouslyDeleteByTag)
				.mockResolvedValueOnce(undefined)
				.mockRejectedValueOnce(new Error('Purge refused'));

			expect(await removeUntilStopped(new Error('The sweep ran out of time'))).toMatchObject({
				unpurged: [{ pathname: moved, reason: 'Error: Purge refused' }],
			});
		});
	});
});

describe('restore', () => {
	it("copies each image back with the image route's cache lifetime, then deletes the trash copy", async () => {
		store(['trash/dish/development/a.jpg']);

		await storeFor('development').restore(['dish/development/a.jpg']);

		expect([...blobs]).toEqual([
			[
				'dish/development/a.jpg',
				{ uploadedAt: expect.any(Date), cacheControlMaxAge: String(yearInSeconds) },
			],
		]);
		expect(received.at(-1)).toMatchObject({
			path: '/delete',
			body: { urls: ['trash/dish/development/a.jpg'] },
		});
	});
});

describe('deleteRemoved', () => {
	it('deletes the trash copies for good, 100 a request', async () => {
		const pathnames = Array.from({ length: 150 }, (_, index) => `scan/development/${index}.jpg`);

		await storeFor('development').deleteRemoved(pathnames);

		expect(received.map(({ body }) => (body as { urls: string[] }).urls)).toEqual([
			pathnames.slice(0, 100).map((pathname) => `trash/${pathname}`),
			pathnames.slice(100).map((pathname) => `trash/${pathname}`),
		]);
	});
});

describe('time limits', () => {
	const pathname = 'dish/development/a.jpg';
	const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

	// A read Blob answered at once, whose body has yet to stream.
	const answeredRead: GetBlobResult = {
		statusCode: 200,
		stream: new ReadableStream(),
		headers: new Headers(),
		blob: {
			url: `https://test.private.blob.vercel-storage.com/${pathname}`,
			downloadUrl: `https://test.private.blob.vercel-storage.com/${pathname}?download=1`,
			pathname,
			contentType: 'image/jpeg',
			contentDisposition: 'inline',
			cacheControl: `public, max-age=${yearInSeconds}`,
			size: 4,
			uploadedAt: longAgo,
			etag: '"etag"',
		},
	};

	beforeEach(() => {
		stalled = true;
		vi.mocked(getBlob).mockImplementation((_pathname, { abortSignal }) => stalledCall(abortSignal));
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.mocked(getBlob).mockReset();
	});

	// The SDK's signal for the read the store last asked Blob for.
	function readSignal(): AbortSignal | undefined {
		return vi.mocked(getBlob).mock.lastCall?.[1].abortSignal;
	}

	it.each([
		['Blob get', (store: BlobImageStore) => store.get(pathname)],
		['Blob head', (store: BlobImageStore) => store.has(pathname)],
		['Blob put', (store: BlobImageStore) => store.put(pathname, jpeg, 'image/jpeg')],
		['Blob list', (store: BlobImageStore) => store.listRemoved()],
		['Blob delete', (store: BlobImageStore) => store.deleteRemoved([pathname])],
	])('gives up on a %s that never answers after 15 seconds, naming the call', async (call, run) => {
		const failure = run(storeFor('development'));
		const settled = vi.fn();
		failure.catch(settled);
		await vi.advanceTimersByTimeAsync(15_000 - 1);
		expect(settled).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);

		await expect(failure).rejects.toThrow(`${call} timed out after 15 seconds`);
	});

	it('gives up on a cache purge that never answers after 15 seconds, leaving its images with why', async () => {
		vi.mocked(dangerouslyDeleteByTag).mockImplementationOnce(() => stalledCall());
		const removal = storeFor('development').remove([pathname]);
		await vi.advanceTimersByTimeAsync(15_000);

		expect(await removal).toEqual({
			failed: [{ pathname, reason: 'Error: Cache purge by tag timed out after 15 seconds' }],
			unpurged: [],
		});
	});

	it('gives up on a copy Blob never answers after 15 seconds, returning the image with why', async () => {
		const removal = storeFor('development').remove([pathname]);
		await vi.advanceTimersByTimeAsync(15_000);

		expect(await removal).toEqual({
			failed: [{ pathname, reason: 'Error: Blob copy timed out after 15 seconds' }],
			unpurged: [],
		});
	});

	it('aborts the request it gives up on', async () => {
		const read = storeFor('development').get(pathname);
		const listing = storeFor('development').listRemoved();
		read.catch(() => undefined);
		listing.catch(() => undefined);
		await vi.advanceTimersByTimeAsync(15_000);
		vi.useRealTimers();

		expect(readSignal()?.aborted).toBe(true);
		await vi.waitFor(() => expect(abandonedCount).toBe(1));
	});

	it("streams a read's body under the caller's signal alone once Blob answered in time", async () => {
		vi.mocked(getBlob).mockResolvedValue(answeredRead);
		const caller = new AbortController();

		expect(await storeFor('development').get(pathname, caller.signal)).toMatchObject({
			contentType: 'image/jpeg',
		});
		await vi.advanceTimersByTimeAsync(15_000);
		expect(readSignal()?.aborted).toBe(false);
		caller.abort();
		expect(readSignal()?.aborted).toBe(true);
	});
});

describe('a sweep through Blob', () => {
	let consoleInfo: MockInstance<typeof console.info>;

	beforeEach(() => {
		consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	// The development deployment's sweep, with nothing naming any image.
	function sweepService(): RecipeImageService {
		const folders = new ImageFolders('development');
		const recipes = new InMemoryRecipeRepository();
		return new RecipeImageService(
			recipes,
			new InMemoryRecipeImportRepository(recipes),
			new InMemorySavedDraftRepository(),
			new BlobImageStore({ storeId: 'store_test', folders }),
			new InMemoryProductionImages(),
			new FixedActorProvider(anonymousActor()),
			folders,
			new InMemoryImageMoveLock(),
			() => {},
			true
		);
	}

	function logLines(): unknown[] {
		return consoleInfo.mock.calls.map(([line]) => JSON.parse(String(line)));
	}

	it('moves the unused uploads whose copies succeed and names the one that failed in its line', async () => {
		store(['dish/development/a.jpg', 'dish/development/unreadable.jpg', 'scan/development/c.jpg']);

		expect(await sweepService().sweepImages()).toEqual({
			status: 'ran',
			result: {
				restoredCount: 0,
				deletedCount: 0,
				removedCount: 2,
				failedCount: 1,
			},
		});
		expect([...blobs.keys()].sort()).toEqual([
			'dish/development/unreadable.jpg',
			'trash/dish/development/a.jpg',
			'trash/scan/development/c.jpg',
		]);
		expect(logLines()).toEqual([
			expect.objectContaining({
				message: 'Images swept',
				removedCount: 2,
				failedCount: 1,
				removedPathnames: ['dish/development/a.jpg', 'scan/development/c.jpg'],
				failedImages: [
					{
						step: 'remove',
						pathname: 'dish/development/unreadable.jpg',
						reason: 'Error: Vercel Blob: The copy failed',
					},
				],
				unpurgedImages: [],
			}),
		]);
	});

	it('names an upload whose purge failed after it moved as removed and unpurged in its line', async () => {
		store(['dish/development/a.jpg']);
		vi.mocked(dangerouslyDeleteBySrcImage)
			.mockResolvedValueOnce(undefined)
			.mockRejectedValueOnce(new Error('Purge refused'));

		expect(await sweepService().sweepImages()).toMatchObject({
			result: { removedCount: 1, failedCount: 0 },
		});
		expect([...blobs.keys()]).toEqual(['trash/dish/development/a.jpg']);
		expect(logLines()).toEqual([
			expect.objectContaining({
				message: 'Images swept',
				removedPathnames: ['dish/development/a.jpg'],
				failedImages: [],
				unpurgedImages: [
					{ step: 'remove', pathname: 'dish/development/a.jpg', reason: 'Error: Purge refused' },
				],
			}),
		]);
	});
});

describe.each([
	['remove', (store: BlobImageStore, pathnames: string[]) => store.remove(pathnames)],
	['restore', (store: BlobImageStore, pathnames: string[]) => store.restore(pathnames)],
	['deleteRemoved', (store: BlobImageStore, pathnames: string[]) => store.deleteRemoved(pathnames)],
])('%s', (_operation, run) => {
	it.each([
		[['dish/production/photo.jpg']],
		[['dish/seed/buttermilk-biscuits.jpg']],
		[['dish/preview/feature-x/photo.jpg', 'dish/production/photo.jpg']],
		[['dish/preview/feature-x/../../production/photo.jpg']],
	])(
		"refuses %j, which reaches outside this environment's folders, before calling Blob",
		async (pathnames) => {
			await expect(run(storeFor('preview/feature-x'), pathnames)).rejects.toThrow(
				"Images outside this environment's folders are never moved or deleted"
			);
			expect(received).toEqual([]);
		}
	);
});
