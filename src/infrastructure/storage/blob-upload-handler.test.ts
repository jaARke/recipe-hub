import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError, SignInRequiredError } from '@/application/authorization';
import { InvalidImageUploadError } from '@/application/recipes/errors';
import type { ImageUploadGrant } from '@/application/recipes/recipe-dtos';
import { BlobUploadHandler } from '@/infrastructure/storage/blob-upload-handler';

type ReceivedRequest = { path?: string; headers: IncomingHttpHeaders; body: unknown };

const storeId = 'store_test';
const pathname = 'dish/development/3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b.jpg';
const grant: ImageUploadGrant = { contentType: 'image/jpeg', maximumSizeInBytes: 8 * 1024 * 1024 };
const yearInSeconds = 365 * 24 * 60 * 60;
const tenMinutes = 10 * 60 * 1000;

let server: Server;
let received: ReceivedRequest[];

function base64Url(value: object): string {
	return Buffer.from(JSON.stringify(value)).toString('base64url');
}

// Blob's API, played by a local server the SDK reaches through its own API URL setting. The
// delegation token it issues carries back the scope it was asked for, as the real one does.
beforeEach(async () => {
	received = [];
	server = createServer(async (request, response) => {
		let body = '';
		for await (const chunk of request) {
			body += chunk;
		}
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
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const { port } = server.address() as AddressInfo;
	vi.stubEnv('VERCEL_BLOB_API_URL', `http://127.0.0.1:${port}`);
	// Unexpired, so the SDK never tries to refresh it.
	vi.stubEnv(
		'VERCEL_OIDC_TOKEN',
		`${base64Url({ alg: 'none' })}.${base64Url({ exp: Date.now() / 1000 + 3600 })}.signature`
	);
});

afterEach(async () => {
	vi.unstubAllEnvs();
	await new Promise((resolve) => server.close(resolve));
});

function createHandler(authorizeUpload: (pathname: string) => Promise<ImageUploadGrant>) {
	return new BlobUploadHandler({
		storeId,
		webhookPublicKey: 'webhook-public-key',
		authorizeUpload,
	});
}

// What the browser's uploadPresigned posts for one file.
function uploadRequest(body: unknown): Request {
	return new Request('http://localhost:3000/api/uploads', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
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

	it('rethrows an unexpected failure', async () => {
		const handler = createHandler(async () => {
			throw new Error('The database could not be reached');
		});

		await expect(handler.handle(uploadRequest(presignedUrlRequest))).rejects.toThrow(
			'The database could not be reached'
		);
	});
});
