export type PageItem = { kind: 'page'; page: number } | { kind: 'gap'; afterPage: number };

// The first and last pages, the current page, and one on each side of it, with a gap for the rest.
export function pageItems(currentPage: number, pageCount: number): PageItem[] {
	const shownPages = [...new Set([1, currentPage - 1, currentPage, currentPage + 1, pageCount])]
		.filter((page) => page >= 1 && page <= pageCount)
		.sort((a, b) => a - b);

	const items: PageItem[] = [];
	let previousPage = 0;
	for (const page of shownPages) {
		// A gap of one page shows that page, which takes no more room than an ellipsis.
		if (page - previousPage === 2) {
			items.push({ kind: 'page', page: page - 1 });
		} else if (page - previousPage > 2) {
			items.push({ kind: 'gap', afterPage: previousPage });
		}
		items.push({ kind: 'page', page });
		previousPage = page;
	}

	return items;
}
