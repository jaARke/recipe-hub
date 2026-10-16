import type { IncomingHttpHeaders } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { startFakeBlobApi, type FakeBlobApi } from '@/infrastructure/storage/testing/fake-blob-api';
import { BlobPreviewStore } from './blob-preview-store';

type ReceivedRequest = {
	method?: string;
	path: string;
	params: Record<string, string>;
	headers: IncomingHttpHeaders;
	body?: unknown;
};

// A read-write token names its store in its fourth segment.
const token = 'vercel_blob_rw_previewstore_secret';
// Small, so a listing of a few blobs takes several pages.
const pageSize = 2;
const longAgo = new Date('2026-10-15T10:17:00Z');

let blobApi: FakeBlobApi;
let blobs: Map<string, Date>;
let received: ReceivedRequest[];

// Blob's API lists by prefix a page at a time, folded into the folders under the prefix when asked,
// and deletes.
beforeEach(async () => {
	blobs = new Map();
	received = [];
	blobApi = await startFakeBlobApi((request, body, response) => {
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
			const prefix = params.prefix;
			const entries = new Set<string>();
			for (const pathname of [...blobs.keys()].filter((p) => p.startsWith(prefix)).sort()) {
				const rest = pathname.slice(prefix.length);
				entries.add(
					params.mode === 'folded' && rest.includes('/')
						? `${prefix}${rest.split('/')[0]}/`
						: pathname
				);
			}
			const listed = [...entries];
			const start = Number(params.cursor ?? 0);
			const page = listed.slice(start, start + pageSize);
			const hasMore = start + pageSize < listed.length;
			answer(200, {
				blobs: page
					.filter((entry) => blobs.has(entry))
					.map((pathname) => ({
						url: `https://test.private.blob.vercel-storage.com/${pathname}`,
						downloadUrl: `https://test.private.blob.vercel-storage.com/${pathname}?download=1`,
						pathname,
						size: 4,
						uploadedAt: blobs.get(pathname)?.toISOString(),
						etag: '"etag"',
					})),
				...(params.mode === 'folded' && { folders: page.filter((entry) => !blobs.has(entry)) }),
				hasMore,
				...(hasMore && { cursor: String(start + pageSize) }),
			});
		} else if (request.method === 'POST' && url.pathname === '/delete') {
			for (const pathname of (JSON.parse(body) as { urls: string[] }).urls) {
				blobs.delete(pathname);
			}
			answer(200, {});
		} else {
			answer(404, { error: { code: 'not_found', message: 'No such route' } });
		}
	});
});

afterEach(async () => {
	await blobApi.close();
});

describe('BlobPreviewStore', () => {
	it('lists the folders directly under a prefix, page by page', async () => {
		for (const name of ['a-1', 'b-2', 'c-3']) {
			blobs.set(`dish/preview/${name}/one.jpg`, longAgo);
			blobs.set(`dish/preview/${name}/two.jpg`, longAgo);
		}
		blobs.set('dish/seed/pancakes.jpg', longAgo);

		const folders = await new BlobPreviewStore(token).listFolders('dish/preview/');

		expect(folders).toEqual(['dish/preview/a-1/', 'dish/preview/b-2/', 'dish/preview/c-3/']);
		expect(received.map(({ params }) => params)).toEqual([
			{ prefix: 'dish/preview/', mode: 'folded' },
			{ prefix: 'dish/preview/', mode: 'folded', cursor: '2' },
		]);
	});

	it('lists every image under a folder with when it was uploaded', async () => {
		const recently = new Date('2026-10-16T10:18:00Z');
		blobs.set('scan/preview/a-1/one.jpg', longAgo);
		blobs.set('scan/preview/a-1/two.jpg', recently);
		blobs.set('scan/preview/a-1/three.jpg', longAgo);
		blobs.set('scan/preview/b-2/four.jpg', longAgo);

		const images = await new BlobPreviewStore(token).listImages('scan/preview/a-1/');

		expect(images).toEqual([
			{ pathname: 'scan/preview/a-1/one.jpg', uploadedAt: longAgo },
			{ pathname: 'scan/preview/a-1/three.jpg', uploadedAt: longAgo },
			{ pathname: 'scan/preview/a-1/two.jpg', uploadedAt: recently },
		]);
	});

	it('deletes 100 images a request', async () => {
		const pathnames = Array.from({ length: 205 }, (_, index) => `dish/preview/a-1/${index}.jpg`);
		for (const pathname of pathnames) {
			blobs.set(pathname, longAgo);
		}

		await new BlobPreviewStore(token).delete(pathnames);

		expect(blobs.size).toBe(0);
		expect(
			received.map(({ path, body }) => [path, (body as { urls: string[] }).urls.length])
		).toEqual([
			['/delete', 100],
			['/delete', 100],
			['/delete', 5],
		]);
	});

	it("sends the store's own token on every call, over Vercel's OIDC token", async () => {
		blobs.set('dish/preview/a-1/one.jpg', longAgo);
		const store = new BlobPreviewStore(token);

		await store.listFolders('dish/preview/');
		await store.listImages('dish/preview/a-1/');
		await store.delete(['dish/preview/a-1/one.jpg']);

		expect(received).toHaveLength(3);
		for (const { headers } of received) {
			expect(headers.authorization).toBe(`Bearer ${token}`);
			expect(headers['x-vercel-blob-store-id']).toBe('previewstore');
		}
	});
});
