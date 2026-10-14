// The browser takes an address that differs from the page's own only in its fragment as a scroll
// within the page, not a page to load.
function scrollsWithinPage(destination: string): boolean {
	const target = new URL(destination, window.location.href);
	if (target.hash === '') {
		return false;
	}
	const page = new URL(window.location.href);
	target.hash = '';
	page.hash = '';
	return target.href === page.href;
}

// Loads the destination as a new page, even when only its fragment changes. Signing in and out do,
// since Next keeps what it fetched for the old session: pages, and a member page's redirect to
// sign-in, which a later navigation would follow.
export function loadPage(destination: string) {
	if (scrollsWithinPage(destination)) {
		window.history.replaceState(null, '', destination);
		window.location.reload();
	} else {
		window.location.assign(destination);
	}
}
