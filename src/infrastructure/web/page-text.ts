import 'server-only';
import { load } from 'cheerio/slim';
import { compile } from 'html-to-text';
import type { WebPage } from '@/application/ports/web-page-fetcher';

// About 25,000 tokens.
const maxPageTextLength = 100_000;

// How deep into nested elements the text reaches. Real pages nest far less, and deeper nesting is
// cut short rather than overflowing the stack.
const maxHtmlDepth = 500;

// Marks where the URL's fragment points, so the text can start there. No page writes it.
const fragmentMarker = '\uE000recipe-hub-fragment\uE000';

// The whole body as plain text, one line per block, with headings and table headers as written.
// Links keep their text without the address, and images are left out. Scripts and styles never
// reach the text.
const bodyText = compile({
	wordwrap: false,
	limits: { maxDepth: maxHtmlDepth },
	selectors: [
		{ selector: 'a', options: { ignoreHref: true } },
		{ selector: 'img', format: 'skip' },
		{ selector: 'h1', options: { uppercase: false } },
		{ selector: 'h2', options: { uppercase: false } },
		{ selector: 'h3', options: { uppercase: false } },
		{ selector: 'h4', options: { uppercase: false } },
		{ selector: 'h5', options: { uppercase: false } },
		{ selector: 'h6', options: { uppercase: false } },
		{ selector: 'table', format: 'dataTable', options: { uppercaseHeaderCells: false } },
	],
});

// The ids the URL's fragment can name, as written and decoded, as browsers try them.
function fragmentIds(url: string): Set<string> {
	const fragment = new URL(url).hash.slice(1);
	if (fragment === '') {
		return new Set();
	}
	try {
		return new Set([fragment, decodeURIComponent(fragment)]);
	} catch {
		return new Set([fragment]);
	}
}

// The page with the marker just before the first element the fragment names, if there is one.
function markedHtml(html: string, ids: ReadonlySet<string>): string {
	const $ = load(html);
	const target = $('[id]')
		.filter((_, element) => ids.has(element.attribs.id ?? ''))
		.first();
	if (target.length === 0) {
		return html;
	}
	target.before(fragmentMarker);
	return $.html();
}

// The page as the AI model reads it: the whole body, starting at the element the URL's fragment
// names, and cut at the last line that fits the cap.
export function pageText(page: WebPage): string {
	const ids = fragmentIds(page.url);
	const text = bodyText(ids.size === 0 ? page.html : markedHtml(page.html, ids));
	const markerAt = text.indexOf(fragmentMarker);
	const trimmed = (markerAt === -1 ? text : text.slice(markerAt + fragmentMarker.length)).trim();
	if (trimmed.length <= maxPageTextLength) {
		return trimmed;
	}
	const lastLineEnd = trimmed.lastIndexOf('\n', maxPageTextLength);
	return trimmed.slice(0, lastLineEnd > 0 ? lastLineEnd : maxPageTextLength).trimEnd();
}
