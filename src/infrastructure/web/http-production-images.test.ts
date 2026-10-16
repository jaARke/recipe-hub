import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpProductionImages } from '@/infrastructure/web/http-production-images';

type Route = (request: IncomingMessage, response: ServerResponse) => void;
type ReceivedRequest = { method?: string; url?: string };

const pathname = 'scan/production/soup-card.jpg';
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

let server: Server;
let siteUrl: URL;
let routes: Record<string, Route>;
let received: ReceivedRequest[];
// Requests the server never answered that the client gave up on.
let abandonedCount: number;

// Production's image route, as it answers an image it serves.
function image(headers: Record<string, string> = { 'content-type': 'image/jpeg', etag: '"abc"' }) {
	return (_: IncomingMessage, response: ServerResponse) => {
		response.writeHead(200, headers);
		response.end(jpeg);
	};
}

function status(code: number, headers: Record<string, string> = {}): Route {
	return (_, response) => {
		response.writeHead(code, headers);
		response.end();
	};
}

// Never answers, as a route that hangs, and counts the request once the client gives up on it.
function silent(asked: () => void): Route {
	return (_, response) => {
		response.on('close', () => {
			abandonedCount += 1;
		});
		asked();
	};
}

async function bytes(body: ReadableStream<Uint8Array> | undefined): Promise<Uint8Array> {
	return new Uint8Array(await new Response(body).arrayBuffer());
}

function production(): HttpProductionImages {
	return new HttpProductionImages({ siteUrl });
}

beforeEach(async () => {
	routes = {};
	received = [];
	abandonedCount = 0;
	server = createServer((request, response) => {
		received.push({ method: request.method, url: request.url });
		(routes[request.url ?? '/'] ?? status(404))(request, response);
	});
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	siteUrl = new URL(`http://127.0.0.1:${(server.address() as AddressInfo).port}/`);
});

afterEach(async () => {
	vi.useRealTimers();
	server.closeAllConnections();
	await new Promise((resolve) => server.close(resolve));
});

describe('get', () => {
	it("returns the image production's route serves, with its type and ETag", async () => {
		routes[`/api/images/${pathname}`] = image();

		const served = await production().get(pathname);

		expect(served).toMatchObject({ contentType: 'image/jpeg', etag: '"abc"' });
		expect(await bytes(served?.body)).toEqual(jpeg);
		expect(received).toEqual([{ method: 'GET', url: `/api/images/${pathname}` }]);
	});

	it('returns null when the route answers 404', async () => {
		expect(await production().get('dish/production/missing.jpg')).toBeNull();
	});

	it.each([403, 500, 503, 206])('throws on status %i, naming it', async (code) => {
		routes[`/api/images/${pathname}`] = status(code, { 'content-type': 'image/jpeg' });

		await expect(production().get(pathname)).rejects.toThrow(
			`Production's image route answered with status ${code}`
		);
	});

	it.each([
		['a Content-Type', { etag: '"abc"' }],
		['an ETag', { 'content-type': 'image/jpeg' }],
	])('throws on an image without %s, which the route passes on', async (_, headers) => {
		routes[`/api/images/${pathname}`] = image(headers);

		await expect(production().get(pathname)).rejects.toThrow(
			"Production's image route answered without a body, a Content-Type, or an ETag"
		);
	});

	it('refuses a redirect rather than following it', async () => {
		const elsewhere = '/api/images/scan/production/elsewhere.jpg';
		routes[`/api/images/${pathname}`] = status(302, { location: elsewhere });
		routes[elsewhere] = image();

		const failure = await production()
			.get(pathname)
			.catch((error: unknown) => error);

		expect(failure).toBeInstanceOf(TypeError);
		expect((failure as TypeError).cause).toMatchObject({ message: 'unexpected redirect' });
		expect(received.map(({ url }) => url)).toEqual([`/api/images/${pathname}`]);
	});
});

describe('get time limit', () => {
	beforeEach(() => {
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
	});

	it('gives up after 20 seconds on a route that never answers, aborting the request', async () => {
		const asked = Promise.withResolvers<void>();
		routes[`/api/images/${pathname}`] = silent(asked.resolve);

		const failure = production().get(pathname);
		const settled = vi.fn();
		failure.catch(settled);
		await asked.promise;
		await vi.advanceTimersByTimeAsync(20_000 - 1);
		expect(settled).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);

		await expect(failure).rejects.toThrow("Production's image route timed out after 20 seconds");
		vi.useRealTimers();
		await vi.waitFor(() => expect(abandonedCount).toBe(1));
	});

	it("streams the body under the caller's signal alone once the route answered in time", async () => {
		routes[`/api/images/${pathname}`] = (_, response) => {
			response.writeHead(200, { 'content-type': 'image/jpeg', etag: '"abc"' });
			response.write(jpeg.subarray(0, 2));
		};
		const caller = new AbortController();

		const served = await production().get(pathname, caller.signal);
		await vi.advanceTimersByTimeAsync(20_000);
		const reader = served!.body.getReader();
		expect(await reader.read()).toMatchObject({ done: false });
		caller.abort(new Error('The visitor left'));

		await expect(reader.read()).rejects.toThrow('The visitor left');
	});
});

describe("get stops at the caller's signal", () => {
	it('while the route has not answered, aborting the request', async () => {
		const asked = Promise.withResolvers<void>();
		routes[`/api/images/${pathname}`] = silent(asked.resolve);
		const caller = new AbortController();

		const failure = production().get(pathname, caller.signal);
		await asked.promise;
		caller.abort(new Error('The visitor left'));

		await expect(failure).rejects.toThrow('The visitor left');
		await vi.waitFor(() => expect(abandonedCount).toBe(1));
	});

	it('without asking once the signal has aborted', async () => {
		await expect(production().get(pathname, AbortSignal.abort(new Error('Gone')))).rejects.toThrow(
			'Gone'
		);
		expect(received).toEqual([]);
	});
});
