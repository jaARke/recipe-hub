import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { vi } from 'vitest';

// Answers one request to the fake API, given its body as text.
export type FakeBlobApiHandler = (
	request: IncomingMessage,
	body: string,
	response: ServerResponse
) => void;

export type FakeBlobApi = {
	// Stops the server and restores the environment.
	close: () => Promise<void>;
};

export function base64Url(value: object): string {
	return Buffer.from(JSON.stringify(value)).toString('base64url');
}

// Blob's API, played by a local server the SDK reaches through its own API URL setting, with an
// unexpired OIDC token, so the SDK never tries to refresh it. Each test answers requests its own way.
export async function startFakeBlobApi(handle: FakeBlobApiHandler): Promise<FakeBlobApi> {
	const server = createServer(async (request, response) => {
		let body = '';
		for await (const chunk of request) {
			body += chunk;
		}
		handle(request, body, response);
	});
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const { port } = server.address() as AddressInfo;
	vi.stubEnv('VERCEL_BLOB_API_URL', `http://127.0.0.1:${port}`);
	vi.stubEnv(
		'VERCEL_OIDC_TOKEN',
		`${base64Url({ alg: 'none' })}.${base64Url({ exp: Date.now() / 1000 + 3600 })}.signature`
	);

	return {
		close: async () => {
			vi.unstubAllEnvs();
			await new Promise((resolve) => server.close(resolve));
		},
	};
}
