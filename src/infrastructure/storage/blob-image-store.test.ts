import type { IncomingHttpHeaders } from 'node:http';
import { get as getBlob, type GetBlobResult } from '@vercel/blob';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageFolders } from '@/application/recipes/image-folders';
import { stalledCall } from '@/application/testing/stalled-call';
import { BlobImageStore } from '@/infrastructure/storage/blob-image-store';
import { startFakeBlobApi, type FakeBlobApi } from '@/infrastructure/storage/testing/fake-blob-api';

// A read goes to the store's own host rather than Blob's API, which the fake API cannot play, so a
// test that reads stands in for the SDK's get.
vi.mock('@vercel/blob', async (importOriginal) => {
	const blob = await importOriginal<typeof import('@vercel/blob')>();
	return { ...blob, get: vi.fn(blob.get) };
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
// While set, the fake API never answers, and counts the requests the client gives up on.
let stalled: boolean;
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
// says so fails.
beforeEach(async () => {
	blobs = new Map();
	received = [];
	stalled = false;
	abandonedCount = 0;
	blobApi = await startFakeBlobApi((request, body, response) => {
		if (stalled) {
			response.on('close', () => {
				abandonedCount += 1;
			});
			return;
		}

		const url = new URL(request.url ?? '/', 'http://127.0.0.1');
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
	it('copies each image into the trash under its pathname, then deletes the originals', async () => {
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
				method: 'PUT',
				params: { pathname: 'trash/scan/development/b.jpg', fromUrl: 'scan/development/b.jpg' },
			}),
			expect.objectContaining({
				method: 'POST',
				path: '/delete',
				body: { urls: ['dish/development/a.jpg', 'scan/development/b.jpg'] },
			}),
		]);
	});

	it('skips an image that is already gone', async () => {
		store(['dish/development/a.jpg']);

		await storeFor('development').remove(['dish/development/gone.jpg', 'dish/development/a.jpg']);

		expect([...blobs.keys()]).toEqual(['trash/dish/development/a.jpg']);
	});

	it('deletes no original when a copy fails', async () => {
		store(['dish/development/a.jpg', 'dish/development/unreadable.jpg']);

		await expect(
			storeFor('development').remove(['dish/development/a.jpg', 'dish/development/unreadable.jpg'])
		).rejects.toThrow('The copy failed');
		expect(blobs.has('dish/development/a.jpg')).toBe(true);
		expect(blobs.has('dish/development/unreadable.jpg')).toBe(true);
		expect(received.some(({ path }) => path === '/delete')).toBe(false);
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

describe('deleteExpired', () => {
	it("deletes the expiring folders' images and trash from before the cutoff, and nothing else", async () => {
		store([
			'dish/preview/feature-x-1a2b3c4d/a.jpg',
			'scan/preview/feature-y-5e6f7a8b/b.jpg',
			'trash/dish/preview/feature-x-1a2b3c4d/c.jpg',
			'dish/production/d.jpg',
			'trash/scan/production/e.jpg',
			'dish/seed/f.jpg',
			'dish/development/g.jpg',
		]);
		store(
			['dish/preview/feature-x-1a2b3c4d/recent.jpg', 'trash/scan/preview/feature-y-5e6f7a8b/h.jpg'],
			recently
		);
		const production = new BlobImageStore({
			storeId: 'store_test',
			folders: new ImageFolders('production', [], ['preview/']),
		});

		expect(await production.deleteExpired(cutoff)).toEqual([
			'dish/preview/feature-x-1a2b3c4d/a.jpg',
			'scan/preview/feature-y-5e6f7a8b/b.jpg',
			'dish/preview/feature-x-1a2b3c4d/c.jpg',
		]);
		expect([...blobs.keys()].sort()).toEqual([
			'dish/development/g.jpg',
			'dish/preview/feature-x-1a2b3c4d/recent.jpg',
			'dish/production/d.jpg',
			'dish/seed/f.jpg',
			'trash/scan/preview/feature-y-5e6f7a8b/h.jpg',
			'trash/scan/production/e.jpg',
		]);
		expect(received.flatMap(({ params }) => params.prefix ?? []).sort()).toEqual([
			'dish/preview/',
			'scan/preview/',
			'trash/dish/preview/',
			'trash/scan/preview/',
		]);
	});

	it('lists and deletes nothing in a deployment that expires no other environment', async () => {
		store(['dish/preview/feature-y-5e6f7a8b/a.jpg', 'dish/production/b.jpg']);

		expect(await storeFor('preview/feature-x-1a2b3c4d').deleteExpired(cutoff)).toEqual([]);
		expect(blobs.size).toBe(2);
		expect(received).toEqual([]);
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
		['get', (store: BlobImageStore) => store.get(pathname)],
		['head', (store: BlobImageStore) => store.has(pathname)],
		['put', (store: BlobImageStore) => store.put(pathname, jpeg, 'image/jpeg')],
		['copy', (store: BlobImageStore) => store.remove([pathname])],
		['list', (store: BlobImageStore) => store.listRemoved()],
		['delete', (store: BlobImageStore) => store.deleteRemoved([pathname])],
	])('gives up on a %s Blob never answers after 15 seconds, naming the call', async (call, run) => {
		const failure = run(storeFor('development'));
		const settled = vi.fn();
		failure.catch(settled);
		await vi.advanceTimersByTimeAsync(15_000 - 1);
		expect(settled).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);

		await expect(failure).rejects.toThrow(`Blob ${call} timed out after 15 seconds`);
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
