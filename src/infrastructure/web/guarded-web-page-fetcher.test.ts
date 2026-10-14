import {
	createServer,
	type IncomingHttpHeaders,
	type IncomingMessage,
	type Server,
	type ServerResponse,
} from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	ImportPageRefusedError,
	ImportPageUnavailableError,
	type PageUnavailableReason,
} from '@/application/ingestion/errors';
import { GuardedWebPageFetcher } from '@/infrastructure/web/guarded-web-page-fetcher';

type Route = (request: IncomingMessage, response: ServerResponse) => void;
type ReceivedRequest = { path?: string; headers: IncomingHttpHeaders };

// A public address that the tests' fetch plays: guarded-fetch checks it like any other and finds it
// public, and the request goes to the local server instead.
const publicOrigin = 'http://1.2.3.4';

const siteUrl = new URL('https://recipes.example.com/');
const page =
	'<!doctype html><html><head><title>Pancakes</title></head><body>Pancakes</body></html>';

let server: Server;
let port: number;
let routes: Record<string, Route>;
let received: ReceivedRequest[];
let requested: string[];

function html(body: string | Uint8Array, headers: Record<string, string> = {}): Route {
	return (_, response) => {
		response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', ...headers });
		response.end(body);
	};
}

// A page whose text shows its encoding: windows-1252 writes each accented character as one byte.
function accentedPage(head: string): string {
	return `<!doctype html><html><head>${head}</head><body>½ cup crème fraîche</body></html>`;
}

function status(code: number, headers: Record<string, string> = {}): Route {
	return (_, response) => {
		response.writeHead(code, { 'content-type': 'text/html', ...headers });
		response.end('<p>Not this page</p>');
	};
}

function redirect(location: string, code = 302): Route {
	return (_, response) => {
		response.writeHead(code, { location });
		response.end();
	};
}

// The web as the fetcher sees it in tests: the public origin is the local server, and any other
// address fails, so a check that let one through shows in `requested`.
const localWeb: typeof fetch = async (input, init) => {
	const url = new URL(String(input));
	requested.push(url.href);
	if (url.origin !== publicOrigin) {
		throw new Error('Tests reach only the public test origin');
	}
	// guarded-fetch's own dispatcher refuses the loopback address the local server listens on.
	return fetch(`http://127.0.0.1:${port}${url.pathname}${url.search}`, {
		...init,
		dispatcher: undefined,
	} as RequestInit);
};

function createFetcher(): GuardedWebPageFetcher {
	return new GuardedWebPageFetcher({ siteUrl, fetch: localWeb });
}

async function fetchError(url: string, fetcher = createFetcher()): Promise<unknown> {
	return fetcher.fetch(url).catch((error: unknown) => error);
}

function unavailable(reason: PageUnavailableReason) {
	return expect.objectContaining({ constructor: ImportPageUnavailableError, reason });
}

beforeEach(async () => {
	routes = {};
	received = [];
	requested = [];
	server = createServer((request, response) => {
		const path = request.url?.split('?')[0] ?? '/';
		received.push({ path, headers: request.headers });
		(routes[path] ?? status(404))(request, response);
	});
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	port = (server.address() as AddressInfo).port;
});

afterEach(async () => {
	vi.useRealTimers();
	server.closeAllConnections();
	await new Promise((resolve) => server.close(resolve));
});

describe('fetch', () => {
	it('reads a page, asking as itself rather than as a browser', async () => {
		routes['/pancakes'] = html(page);

		const result = await createFetcher().fetch(`${publicOrigin}/pancakes`);

		expect(result).toEqual({ url: `${publicOrigin}/pancakes`, html: page });
		expect(received[0]?.headers['user-agent']).toBe(
			'BarbsTable/1.0 (+https://recipes.example.com)'
		);
	});

	it('follows redirects to the address finally served, keeping the fragment asked for', async () => {
		routes['/old'] = redirect('/older', 301);
		routes['/older'] = redirect(`${publicOrigin}/pancakes`, 308);
		routes['/pancakes'] = html(page);

		const result = await createFetcher().fetch(`${publicOrigin}/old#recipe`);

		expect(result.url).toBe(`${publicOrigin}/pancakes#recipe`);
		expect(received.map((request) => request.path)).toEqual(['/old', '/older', '/pancakes']);
	});

	it('takes the fragment a redirect names', async () => {
		routes['/jump'] = redirect('/pancakes#recipe-card');
		routes['/pancakes'] = html(page);

		const result = await createFetcher().fetch(`${publicOrigin}/jump#comments`);

		expect(result.url).toBe(`${publicOrigin}/pancakes#recipe-card`);
	});

	it.each(['text/html', 'text/html; charset=ISO-8859-1', 'application/xhtml+xml'])(
		'reads a page served as %s',
		async (contentType) => {
			routes['/pancakes'] = html(page, { 'content-type': contentType });

			await expect(createFetcher().fetch(`${publicOrigin}/pancakes`)).resolves.toMatchObject({
				html: page,
			});
		}
	);

	it.each<[string, string, string, BufferEncoding]>([
		['the charset its Content-Type names', 'text/html; charset=ISO-8859-1', '', 'latin1'],
		['the charset a <meta> declares', 'text/html', '<meta charset="windows-1252">', 'latin1'],
		[
			'the charset an http-equiv <meta> declares',
			'text/html',
			'<meta http-equiv="Content-Type" content="text/html; charset=iso-8859-1">',
			'latin1',
		],
		[
			'the Content-Type’s charset over the <meta>’s',
			'text/html; charset=utf-8',
			'<meta charset="iso-8859-1">',
			'utf8',
		],
		[
			'the <meta>’s charset when the Content-Type’s is unknown',
			'text/html; charset=pancakes',
			'<meta charset="iso-8859-1">',
			'latin1',
		],
		['UTF-8 when nothing names a charset', 'text/html', '', 'utf8'],
		['UTF-8 when the <meta> declares UTF-16', 'text/html', '<meta charset="utf-16">', 'utf8'],
		[
			'UTF-8 when the only <meta> is inside a comment',
			'text/html',
			'<!-- <meta charset="iso-8859-1"> -->',
			'utf8',
		],
	])('decodes a page in %s', async (_, contentType, head, encoding) => {
		const written = accentedPage(head);
		routes['/pancakes'] = html(Buffer.from(written, encoding), { 'content-type': contentType });

		await expect(createFetcher().fetch(`${publicOrigin}/pancakes`)).resolves.toMatchObject({
			html: written,
		});
	});

	it('decodes a page by its byte order mark over its Content-Type’s charset', async () => {
		const written = accentedPage('');
		const utf8Bom = Buffer.from([0xef, 0xbb, 0xbf]);
		routes['/pancakes'] = html(Buffer.concat([utf8Bom, Buffer.from(written)]), {
			'content-type': 'text/html; charset=ISO-8859-1',
		});

		await expect(createFetcher().fetch(`${publicOrigin}/pancakes`)).resolves.toMatchObject({
			html: written,
		});
	});

	it.each([401, 402, 403, 429, 451])('reports status %i as the site refusing', async (code) => {
		routes['/pancakes'] = status(code);

		const error = await fetchError(`${publicOrigin}/pancakes`);

		expect(error).toBeInstanceOf(ImportPageRefusedError);
		expect((error as ImportPageRefusedError).status).toBe(code);
	});

	it('reports a challenge page as the site refusing, whatever its status', async () => {
		routes['/pancakes'] = status(503, { 'cf-mitigated': 'challenge' });

		const error = await fetchError(`${publicOrigin}/pancakes`);

		expect(error).toBeInstanceOf(ImportPageRefusedError);
		expect((error as ImportPageRefusedError).status).toBe(503);
	});

	it.each<[number, PageUnavailableReason]>([
		[404, 'not-found'],
		[410, 'not-found'],
		[500, 'unreachable'],
		[503, 'unreachable'],
	])('reports status %i as %s', async (code, reason) => {
		routes['/pancakes'] = status(code);

		await expect(fetchError(`${publicOrigin}/pancakes`)).resolves.toEqual(unavailable(reason));
	});

	// ISO-2022-KR is one of the encodings the HTML standard refuses to read.
	it.each(['application/json', 'image/png', '', 'text/html; charset=iso-2022-kr'])(
		'refuses a response served as "%s"',
		async (contentType) => {
			routes['/pancakes'] = (_, response) => {
				response.writeHead(200, contentType === '' ? {} : { 'content-type': contentType });
				response.end('{}');
			};

			await expect(fetchError(`${publicOrigin}/pancakes`)).resolves.toEqual(
				unavailable('not-html')
			);
		}
	);

	it('follows five redirects and refuses a sixth', async () => {
		for (let hop = 0; hop < 6; hop += 1) {
			routes[`/hop-${hop}`] = redirect(`/hop-${hop + 1}`);
		}
		routes['/hop-5'] = html(page);
		const fetcher = createFetcher();

		await expect(fetcher.fetch(`${publicOrigin}/hop-0`)).resolves.toMatchObject({
			url: `${publicOrigin}/hop-5`,
		});

		routes['/hop-5'] = redirect('/hop-6');
		routes['/hop-6'] = html(page);
		await expect(fetchError(`${publicOrigin}/hop-0`, fetcher)).resolves.toEqual(
			unavailable('unreachable')
		);
		expect(received.map((request) => request.path)).not.toContain('/hop-6');
	});

	it('stops reading a page past 5 MB, counting as it arrives', async () => {
		routes['/huge'] = (_, response) => {
			response.writeHead(200, { 'content-type': 'text/html' });
			const chunk = '<p>pancakes</p>'.repeat(4096);
			for (let written = 0; written <= 5 * 1024 * 1024; written += chunk.length) {
				response.write(chunk);
			}
			response.end();
		};

		await expect(fetchError(`${publicOrigin}/huge`)).resolves.toEqual(unavailable('too-large'));
	});

	it('reports a page that cannot be reached, keeping only codes from the failure', async () => {
		server.close();
		server.closeAllConnections();

		const error = await fetchError(`${publicOrigin}/pancakes?token=secret`);

		expect(error).toEqual(unavailable('unreachable'));
		expect((error as Error).cause).toEqual({ code: 'network_error', causeCode: 'ECONNREFUSED' });
	});

	it('reports a host that does not resolve as unreachable', async () => {
		await expect(fetchError('http://pancakes.invalid/')).resolves.toEqual(
			unavailable('unreachable')
		);
	});
});

describe('fetch time limit', () => {
	beforeEach(() => {
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
	});

	it('gives up after 10 seconds on a site that never answers', async () => {
		const asked = Promise.withResolvers<void>();
		routes['/slow'] = () => asked.resolve();

		const result = fetchError(`${publicOrigin}/slow`);
		await asked.promise;
		await vi.advanceTimersByTimeAsync(10 * 1000);

		await expect(result).resolves.toEqual(unavailable('timed-out'));
	});

	it('gives up after 10 seconds on a page still arriving', async () => {
		const started = Promise.withResolvers<void>();
		routes['/slow'] = (_, response) => {
			response.writeHead(200, { 'content-type': 'text/html' });
			response.write('<p>Pancakes', () => started.resolve());
		};

		const result = fetchError(`${publicOrigin}/slow`);
		await started.promise;
		// Lets the response reach the fetcher, which then waits on the body.
		await new Promise((resolve) => setImmediate(resolve));
		await vi.advanceTimersByTimeAsync(10 * 1000);

		await expect(result).resolves.toEqual(unavailable('timed-out'));
	});
});

describe("fetch stops at the caller's signal", () => {
	it('while the site has not answered', async () => {
		const asked = Promise.withResolvers<void>();
		routes['/slow'] = () => asked.resolve();
		const caller = new AbortController();

		const result = createFetcher()
			.fetch(`${publicOrigin}/slow`, caller.signal)
			.catch((error: unknown) => error);
		await asked.promise;
		caller.abort();

		await expect(result).resolves.toEqual(unavailable('unreachable'));
	});

	it('while the page is still arriving', async () => {
		routes['/slow'] = (_, response) => {
			response.writeHead(200, { 'content-type': 'text/html' });
			response.write('<p>Pancakes');
		};
		const answered = Promise.withResolvers<void>();
		const fetcher = new GuardedWebPageFetcher({
			siteUrl,
			fetch: async (input, init) => {
				const response = await localWeb(input, init);
				answered.resolve();
				return response;
			},
		});
		const caller = new AbortController();

		const result = fetcher
			.fetch(`${publicOrigin}/slow`, caller.signal)
			.catch((error: unknown) => error);
		await answered.promise;
		// Lets guarded-fetch hand the response to the fetcher, which then waits on the body.
		await new Promise((resolve) => setImmediate(resolve));
		caller.abort();

		await expect(result).resolves.toEqual(unavailable('unreachable'));
	});
});

describe('fetch refuses an address that is not public', () => {
	it.each([
		'http://127.0.0.1/',
		'http://localhost/',
		'http://0.0.0.0/',
		'http://10.0.0.1/',
		'http://172.16.0.1/',
		'http://192.168.1.1/',
		'http://169.254.169.254/latest/meta-data/',
		'http://100.64.0.1/',
		'http://[::1]/',
		'http://[::ffff:127.0.0.1]/',
		'http://[::ffff:a9fe:a9fe]/',
		'http://[fd00::1]/',
		'http://[fe80::1]/',
		'http://2130706433/',
		'http://0177.0.0.1/',
		'http://0x7f000001/',
		// Public DNS answers 127.0.0.1 for it.
		'http://localtest.me/',
		'http://user:secret@1.2.3.4/',
		'http://1.2.3.4:8080/',
		'https://1.2.3.4:22/',
		'ftp://1.2.3.4/',
		'file:///etc/passwd',
		'not a url',
	])('%s, before asking for it', async (url) => {
		await expect(fetchError(url)).resolves.toEqual(unavailable('not-public'));
		expect(requested).toEqual([]);
	});

	it.each([
		'http://127.0.0.1/secret',
		'http://169.254.169.254/latest/meta-data/',
		'http://localtest.me/secret',
		'http://user:secret@1.2.3.4/secret',
	])('when a public page redirects to %s', async (location) => {
		routes['/pancakes'] = redirect(location);

		await expect(fetchError(`${publicOrigin}/pancakes`)).resolves.toEqual(
			unavailable('not-public')
		);
		expect(requested).toEqual([`${publicOrigin}/pancakes`]);
	});

	it('when a public page redirects to the local server itself', async () => {
		routes['/pancakes'] = redirect(`http://127.0.0.1:${port}/secret`);
		routes['/secret'] = html(page);

		await expect(fetchError(`${publicOrigin}/pancakes`)).resolves.toEqual(
			unavailable('not-public')
		);
		expect(received.map((request) => request.path)).toEqual(['/pancakes']);
	});

	it('without a fetch of its own, as the composition root builds it', async () => {
		const fetcher = new GuardedWebPageFetcher({ siteUrl });

		await expect(fetchError('http://127.0.0.1/', fetcher)).resolves.toEqual(
			unavailable('not-public')
		);
		await expect(fetchError('http://localtest.me/', fetcher)).resolves.toEqual(
			unavailable('not-public')
		);
		expect(received).toEqual([]);
	});
});
