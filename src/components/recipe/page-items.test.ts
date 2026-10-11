import { describe, expect, it } from 'vitest';
import { pageItems, type PageItem } from '@/components/recipe/page-items';

// Pages as numbers and gaps as an ellipsis, so each case reads like the rendered list.
function describeItems(items: readonly PageItem[]): (number | '…')[] {
	return items.map((item) => (item.kind === 'page' ? item.page : '…'));
}

describe('pageItems', () => {
	it.each([
		[1, 1, [1]],
		[1, 2, [1, 2]],
		[2, 3, [1, 2, 3]],
		[1, 5, [1, 2, '…', 5]],
		[3, 5, [1, 2, 3, 4, 5]],
		[1, 10, [1, 2, '…', 10]],
		[3, 10, [1, 2, 3, 4, '…', 10]],
		[4, 10, [1, 2, 3, 4, 5, '…', 10]],
		[5, 10, [1, '…', 4, 5, 6, '…', 10]],
		[7, 10, [1, '…', 6, 7, 8, 9, 10]],
		[10, 10, [1, '…', 9, 10]],
	])('lists page %s of %s as %j', (currentPage, pageCount, expected) => {
		expect(describeItems(pageItems(currentPage, pageCount))).toEqual(expected);
	});

	it('keys each gap by the page before it', () => {
		expect(pageItems(5, 10).filter((item) => item.kind === 'gap')).toEqual([
			{ kind: 'gap', afterPage: 1 },
			{ kind: 'gap', afterPage: 6 },
		]);
	});
});
