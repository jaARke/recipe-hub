import type { WebPage, WebPageFetcher } from '@/application/ports/web-page-fetcher';

// Serves one page for every address, or fails as a site would, and records the addresses asked for.
export class FixedWebPageFetcher implements WebPageFetcher {
	private readonly result: WebPage | Error;
	private readonly urls: string[] = [];

	constructor(result: WebPage | Error) {
		this.result = result;
	}

	get fetchedUrls(): readonly string[] {
		return this.urls;
	}

	async fetch(url: string): Promise<WebPage> {
		this.urls.push(url);
		if (this.result instanceof Error) {
			throw this.result;
		}

		return this.result;
	}
}
