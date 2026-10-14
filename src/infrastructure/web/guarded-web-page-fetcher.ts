import 'server-only';
import { MIMEType } from 'node:util';
import { decodeBuffer } from 'encoding-sniffer';
import {
	guardedFetch,
	GuardedFetchErrorCode,
	HostnameUnsafeSubReason,
	isGuardedFetchError,
	type GuardedFetchOptions,
	type UrlBlockedSubReason,
} from 'guarded-fetch';
import {
	ImportPageRefusedError,
	ImportPageUnavailableError,
	type PageUnavailableReason,
} from '@/application/ingestion/errors';
import type { WebPage, WebPageFetcher } from '@/application/ports/web-page-fetcher';
import { deadlineAfter, settleWithin } from '@/lib/deadline';
import { siteName } from '@/lib/site';

// For the whole fetch: every redirect and the body.
const fetchTimeoutMs = 10 * 1000;
const maxRedirects = 5;
// Counted as the body arrives, after decompression.
const maxPageSizeInBytes = 5 * 1024 * 1024;

// An empty port is the scheme's default.
const allowedPorts = new Set(['', '80', '443']);
const htmlMediaTypes = new Set(['text/html', 'application/xhtml+xml']);
const redirectStatuses = new Set([301, 302, 303, 307, 308]);
// What sites that license their content or turn bots away answer with.
const refusalStatuses = new Set([401, 402, 403, 429, 451]);
const goneStatuses = new Set([404, 410]);

type GuardedWebPageFetcherOptions = {
	// Named in the User-Agent, so a site can tell who is fetching its page.
	siteUrl: URL;
	// guarded-fetch's seam for tests: every check still runs, and only the connection is the test's.
	fetch?: GuardedFetchOptions['fetch'];
};

type FetchedResponse = {
	response: Response;
	address: URL;
};

// What a failed fetch's cause keeps: guarded-fetch's code, or the error's own, and the code beneath it.
type FailureCodes = {
	code?: string;
	causeCode?: string;
};

// The address as given, refused when it carries credentials or names a port other than the web's.
// guarded-fetch checks the scheme and the host.
function webAddress(address: URL): URL {
	if (address.username !== '' || address.password !== '' || !allowedPorts.has(address.port)) {
		throw new ImportPageUnavailableError('not-public');
	}
	return address;
}

// A redirect without a fragment keeps the one before it, as browsers do.
function redirectAddress(location: string, from: URL): URL {
	let address: URL;
	try {
		address = new URL(location, from);
	} catch {
		throw new ImportPageUnavailableError('unreachable');
	}
	if (address.hash === '') {
		address.hash = from.hash;
	}
	return webAddress(address);
}

// Cloudflare marks the challenge pages it serves instead of the page.
function isChallenge(headers: Headers): boolean {
	return headers.get('cf-mitigated') === 'challenge';
}

// The Content-Type header, or undefined when it is missing or does not parse.
function contentType(headers: Headers): MIMEType | undefined {
	const value = headers.get('content-type');
	if (value === null) {
		return undefined;
	}
	try {
		return new MIMEType(value);
	} catch {
		return undefined;
	}
}

function isHtml(headers: Headers): boolean {
	const essence = contentType(headers)?.essence;
	return essence !== undefined && htmlMediaTypes.has(essence);
}

// Why the page is out of reach, or null when it can be read.
function unreadableResponse(
	response: Response
): ImportPageRefusedError | ImportPageUnavailableError | null {
	if (refusalStatuses.has(response.status) || isChallenge(response.headers)) {
		return new ImportPageRefusedError(response.status);
	}
	if (goneStatuses.has(response.status)) {
		return new ImportPageUnavailableError('not-found');
	}
	if (!response.ok) {
		return new ImportPageUnavailableError('unreachable');
	}
	if (!isHtml(response.headers)) {
		return new ImportPageUnavailableError('not-html');
	}
	return null;
}

// guarded-fetch keeps DNS failures with its blocks, and tells them apart only in the block event.
function unavailableReason(
	error: unknown,
	blockedBy: UrlBlockedSubReason | undefined
): PageUnavailableReason {
	if (!isGuardedFetchError(error)) {
		return 'unreachable';
	}
	switch (error.code) {
		case GuardedFetchErrorCode.TIMEOUT:
			return 'timed-out';
		case GuardedFetchErrorCode.RESPONSE_TOO_LARGE:
			return 'too-large';
		case GuardedFetchErrorCode.PROTOCOL_NOT_ALLOWED:
			return 'not-public';
		case GuardedFetchErrorCode.HOSTNAME_UNSAFE:
			return blockedBy === HostnameUnsafeSubReason.DNS_RESOLUTION_FAILED
				? 'unreachable'
				: 'not-public';
		default:
			return 'unreachable';
	}
}

// guarded-fetch's messages quote the address, so the cause keeps only codes, which keeps the address
// out of the error chain. The import service logs a page-unavailable error's reason, not its cause.
function failureCodes(error: unknown): FailureCodes {
	const codes: string[] = [];
	for (let current = error; current instanceof Error; current = current.cause) {
		if ('code' in current && typeof current.code === 'string') {
			codes.push(current.code);
		}
	}
	return { code: codes[0], causeCode: codes[1] };
}

function unavailable(error: unknown, blockedBy?: UrlBlockedSubReason): ImportPageUnavailableError {
	return new ImportPageUnavailableError(unavailableReason(error, blockedBy), {
		cause: failureCodes(error),
	});
}

function timedOut(): ImportPageUnavailableError {
	return new ImportPageUnavailableError('timed-out');
}

// The body as bytes, read before the deadline or the caller's signal stops it, and refused once it
// passes the size limit, counted as it arrives. guarded-fetch's own reader decodes everything as UTF-8.
async function bodyBytes(
	response: Response,
	deadlineAt: number,
	signal: AbortSignal | undefined
): Promise<Buffer> {
	if (response.body === null) {
		return Buffer.alloc(0);
	}
	const limits = { deadline: deadlineAfter(deadlineAt - Date.now()), cancellation: signal };
	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let size = 0;
	try {
		for (;;) {
			const { done, value } = await settleWithin(reader.read(), limits, timedOut);
			if (done) {
				return Buffer.concat(chunks);
			}
			size += value.byteLength;
			if (size > maxPageSizeInBytes) {
				throw new ImportPageUnavailableError('too-large');
			}
			chunks.push(value);
		}
	} catch (error) {
		await reader.cancel().catch(() => undefined);
		throw error instanceof ImportPageUnavailableError ? error : unavailable(error);
	} finally {
		reader.releaseLock();
	}
}

// The page as text, in the encoding the HTML standard's sniffing picks: a byte order mark, then the
// Content-Type's charset, then a <meta> near the start, then UTF-8.
function pageHtml(bytes: Buffer, headers: Headers): string {
	try {
		return decodeBuffer(bytes, {
			transportLayerEncodingLabel: contentType(headers)?.params.get('charset') ?? undefined,
			defaultEncoding: 'utf-8',
		});
	} catch {
		// Only the replacement encoding, which stands in for encodings unsafe to read, has no decoder.
		throw new ImportPageUnavailableError('not-html');
	}
}

// Fetches pages members name through guarded-fetch, which refuses every address that is not public,
// including one a host's DNS changes to between the check and the connection.
export class GuardedWebPageFetcher implements WebPageFetcher {
	private readonly headers: Record<string, string>;
	private readonly fetchImplementation: GuardedFetchOptions['fetch'];

	constructor(options: GuardedWebPageFetcherOptions) {
		this.headers = {
			// Honest about what is asking. A product token is plain ASCII: a curly apostrophe in a header throws.
			'user-agent': `${siteName.replaceAll(/[^A-Za-z0-9]/g, '')}/1.0 (+${options.siteUrl.origin})`,
			accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
			'accept-language': 'en-US,en;q=0.9',
		};
		this.fetchImplementation = options.fetch;
	}

	async fetch(url: string, signal?: AbortSignal): Promise<WebPage> {
		const deadlineAt = Date.now() + fetchTimeoutMs;
		let requested: URL;
		try {
			requested = new URL(url);
		} catch {
			throw new ImportPageUnavailableError('not-public');
		}

		const { response, address } = await this.followRedirects(
			webAddress(requested),
			deadlineAt,
			signal
		);
		const unreadable = unreadableResponse(response);
		if (unreadable !== null) {
			await response.body?.cancel();
			throw unreadable;
		}

		const bytes = await bodyBytes(response, deadlineAt, signal);
		return { url: address.href, html: pageHtml(bytes, response.headers) };
	}

	// Each redirect is its own guarded request, so every address passes the same checks, the port's
	// included, which guarded-fetch's own redirects skip.
	private async followRedirects(
		address: URL,
		deadlineAt: number,
		signal: AbortSignal | undefined
	): Promise<FetchedResponse> {
		let current = address;
		for (let redirects = 0; ; redirects += 1) {
			const response = await this.request(current, deadlineAt, signal);
			const location = redirectStatuses.has(response.status)
				? response.headers.get('location')
				: null;
			if (location === null) {
				return { response, address: current };
			}

			await response.body?.cancel();
			if (redirects === maxRedirects) {
				throw new ImportPageUnavailableError('unreachable');
			}
			current = redirectAddress(location, current);
		}
	}

	private async request(
		address: URL,
		deadlineAt: number,
		signal: AbortSignal | undefined
	): Promise<Response> {
		let blockedBy: UrlBlockedSubReason | undefined;
		try {
			return await guardedFetch(address, {
				headers: this.headers,
				followRedirects: false,
				timeoutMs: deadlineAt - Date.now(),
				signal,
				fetch: this.fetchImplementation,
				onUrlBlocked: (event) => {
					blockedBy = event.subReason;
				},
			});
		} catch (error) {
			throw unavailable(error, blockedBy);
		}
	}
}
