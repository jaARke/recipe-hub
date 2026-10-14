import type { IncomingHttpHeaders } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError, SignInRequiredError } from '@/application/authorization';
import { InvalidImageUploadError } from '@/application/recipes/errors';
import type { ImageUploadGrant } from '@/application/recipes/recipe-dtos';
import { BlobUploadHandler } from '@/infrastructure/storage/blob-upload-handler';
import {
	base64Url,
	startFakeBlobApi,
	type FakeBlobApi,
} from '@/infrastructure/storage/testing/fake-blob-api';

type ReceivedRequest = { path?: string; headers: IncomingHttpHeaders; body: unknown };

const storeId = 'store_test';
const pathname = 'dish/development/3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b.jpg';
const grant: ImageUploadGrant = { contentType: 'image/jpeg', maximumSizeInBytes: 8 * 1024 * 1024 };
const yearInSeconds = 365 * 24 * 60 * 60;
const tenMinutes = 10 * 60 * 1000;

let blobApi: FakeBlobApi;
let received: ReceivedRequest[];

// The delegation token Blob's API issues carries back the scope it was asked for, as the real one
// does.
beforeEach(async () => {
	received = [];
	blobApi = await startFakeBlobApi((request, body, response) => {
		const scope = JSON.parse(body);
		received.push({ path: request.url, headers: request.headers, body: scope });
		response.writeHead(200, { 'content-type': 'application/json' });
		response.end(
			JSON.stringify({
				delegationToken: `${base64Url(scope)}.store-signature`,
				clientSigningToken: 'client-signing-token',
				validUntil: scope.validUntil,
			})
		);
	});
});

afterEach(async () => {
	vi.restoreAllMocks();
	await blobApi.close();
});

function createHandler(authorizeUpload: (pathname: string) => Promise<ImageUploadGrant>) {
	return new BlobUploadHandler({
		storeId,
		webhookPublicKey: 'webhook-public-key',
		allowedHosts: ['recipes.example.com', 'recipe-hub-git-feature.vercel.app'],
		authorizeUpload,
	});
}

// What the browser's uploadPresigned posts for one file from one of the site's pages.
function uploadRequest(
	body: unknown,
	from: Record<string, string> = { 'sec-fetch-site': 'same-origin' }
): Request {
	return new Request('https://recipes.example.com/api/uploads', {
		method: 'POST',
		headers: { 'content-type': 'application/json', ...from },
		body: typeof body === 'string' ? body : JSON.stringify(body),
	});
}

const presignedUrlRequest = {
	type: 'blob.generate-presigned-url',
	payload: { pathname, multipart: false },
};

describe('handle', () => {
	it('asks the application, then returns a presigned URL for that one JPEG pathname', async () => {
		const authorizeUpload = vi.fn(async () => grant);
		const before = Date.now();

		const response = await createHandler(authorizeUpload).handle(
			uploadRequest(presignedUrlRequest)
		);

		expect(authorizeUpload).toHaveBeenCalledExactlyOnceWith(pathname);
		expect(received).toEqual([
			{
				path: '/signed-token',
				headers: expect.objectContaining({ 'x-vercel-blob-store-id': 'test' }),
				body: {
					pathname,
					operations: ['put'],
					allowedContentTypes: ['image/jpeg'],
					maximumSizeInBytes: grant.maximumSizeInBytes,
					validUntil: expect.any(Number),
				},
			},
		]);
		// Ten minutes from when it was issued.
		const { validUntil } = received[0]?.body as { validUntil: number };
		expect(validUntil).toBeGreaterThanOrEqual(before + tenMinutes);
		expect(validUntil).toBeLessThanOrEqual(Date.now() + tenMinutes);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			type: 'blob.generate-presigned-url',
			presignedUrlPayload: {
				delegationToken: expect.any(String),
				signature: expect.any(String),
				params: {
					'vercel-blob-allowed-content-types': 'image/jpeg',
					'vercel-blob-maximum-size-in-bytes': String(grant.maximumSizeInBytes),
					'vercel-blob-add-random-suffix': 'false',
					'vercel-blob-allow-overwrite': 'false',
					'vercel-blob-cache-control-max-age': String(yearInSeconds),
				},
			},
		});
	});

	it.each([
		['sign-in is required', new SignInRequiredError(), 401],
		['the member may not upload', new ForbiddenError(), 403],
		['the pathname is not a new upload', new InvalidImageUploadError(), 400],
	])('answers without a token when %s', async (_case, error, status) => {
		const response = await createHandler(async () => {
			throw error;
		}).handle(uploadRequest(presignedUrlRequest));

		expect(response.status).toBe(status);
		expect(await response.text()).toBe('');
		expect(received).toEqual([]);
	});

	it.each([
		['malformed JSON', '{"type":'],
		['a completion callback', { type: 'blob.upload-completed', payload: {} }],
		['a multipart upload', { ...presignedUrlRequest, payload: { pathname, multipart: true } }],
		['no pathname', { ...presignedUrlRequest, payload: { multipart: false } }],
	])('refuses %s without asking the application', async (_case, body) => {
		const authorizeUpload = vi.fn(async () => grant);

		const response = await createHandler(authorizeUpload).handle(uploadRequest(body));

		expect(response.status).toBe(400);
		expect(authorizeUpload).not.toHaveBeenCalled();
		expect(received).toEqual([]);
	});

	it.each([
		['the browser calls it the same origin', { 'sec-fetch-site': 'same-origin' }],
		['its origin is a host of the deployment', { origin: 'https://recipes.example.com' }],
		[
			"its origin is another of the deployment's hosts",
			{ 'sec-fetch-site': 'cross-site', origin: 'https://recipe-hub-git-feature.vercel.app' },
		],
	])('accepts a request when %s', async (_case, from) => {
		const response = await createHandler(async () => grant).handle(
			uploadRequest(presignedUrlRequest, from)
		);

		expect(response.status).toBe(200);
	});

	it.each<[string, Record<string, string>]>([
		[
			'another subdomain of the same site',
			{ 'sec-fetch-site': 'same-site', origin: 'https://blog.example.com' },
		],
		['another site', { 'sec-fetch-site': 'cross-site', origin: 'https://attacker.example' }],
		['an opaque origin', { origin: 'null' }],
		['an origin on another port', { origin: 'https://recipes.example.com:8443' }],
		['no origin at all', {}],
	])(
		'refuses a request from %s without asking the application, and logs it',
		async (_case, from) => {
			const authorizeUpload = vi.fn(async () => grant);
			const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

			const response = await createHandler(authorizeUpload).handle(
				uploadRequest(presignedUrlRequest, from)
			);

			expect(response.status).toBe(403);
			expect(authorizeUpload).not.toHaveBeenCalled();
			expect(received).toEqual([]);
			expect(consoleWarn.mock.calls.map(([line]) => JSON.parse(String(line)))).toEqual([
				{
					level: 'warn',
					logger: 'images',
					message: 'Image upload refused from another site',
					fetchSite: from['sec-fetch-site'] ?? null,
					origin: from.origin ?? null,
				},
			]);
		}
	);

	it('rethrows an unexpected failure', async () => {
		const handler = createHandler(async () => {
			throw new Error('The database could not be reached');
		});

		await expect(handler.handle(uploadRequest(presignedUrlRequest))).rejects.toThrow(
			'The database could not be reached'
		);
	});
});
