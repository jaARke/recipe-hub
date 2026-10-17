import { afterEach } from 'vitest';

// The parts of the Navigation API's navigate event read here, which TypeScript's DOM types lack.
type NavigateEvent = Event & {
	readonly navigationType: NavigationType;
	readonly destination: { readonly url: string; readonly sameDocument: boolean };
};

type NavigateListener = (event: NavigateEvent) => void;

type TabNavigation = {
	addEventListener(type: 'navigate', listener: NavigateListener): void;
	removeEventListener(type: 'navigate', listener: NavigateListener): void;
};

// A page load a test held: the address it would have loaded, from its path on, and how.
export type HeldPageLoad = { path: string; type: NavigationType };

const releases: (() => void)[] = [];

afterEach(() => {
	for (const release of releases.splice(0)) {
		release();
	}
});

// Holds back each page load until the test ends, since one would replace the test's own frame, and
// lists them; a test cannot spy on Location, whose members are unforgeable. A click on a link with a
// key held, which would load its page in a tab or window nothing closes, loads nothing: its default
// is cancelled once it bubbles to the document, after the page's own handlers have seen it.
export function holdPageLoads(): readonly HeldPageLoad[] {
	const navigation = (globalThis as unknown as { navigation: TabNavigation }).navigation;
	const loads: HeldPageLoad[] = [];
	const hold: NavigateListener = (event) => {
		if (!event.destination.sameDocument) {
			const { pathname, search, hash } = new URL(event.destination.url);
			loads.push({ path: `${pathname}${search}${hash}`, type: event.navigationType });
			event.preventDefault();
		}
	};
	const cancelModifiedLinkClick = (event: MouseEvent) => {
		const modified = event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
		if (modified && event.target instanceof Element && event.target.closest('a[href]') !== null) {
			event.preventDefault();
		}
	};
	navigation.addEventListener('navigate', hold);
	document.addEventListener('click', cancelModifiedLinkClick);
	releases.push(() => {
		navigation.removeEventListener('navigate', hold);
		document.removeEventListener('click', cancelModifiedLinkClick);
	});
	return loads;
}
