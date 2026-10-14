// Whether focus fell to the page, as when the element holding it was removed. An element hidden with
// a page Next keeps holds focus until the browser next renders, so it counts as fallen.
export function focusFellToPage(): boolean {
	const focused = document.activeElement;
	return focused === null || focused === document.body || focused.getClientRects().length === 0;
}
