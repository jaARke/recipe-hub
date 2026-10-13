import 'server-only';

export type WebPage = {
	// The address finally served, after redirects. It keeps the requested address's fragment unless a
	// redirect names its own, as browsers do.
	url: string;
	html: string;
};

export interface WebPageFetcher {
	// Fetches a public HTML page within the adapter's time and size limits. Throws
	// ImportPageRefusedError when the site turns the request away, and ImportPageUnavailableError for
	// anything else that keeps the page from being read.
	fetch(url: string): Promise<WebPage>;
}
