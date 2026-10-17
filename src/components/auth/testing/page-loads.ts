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
// lists them; a test cannot spy on Location, whose members are unforgeable.
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
	navigation.addEventListener('navigate', hold);
	releases.push(() => navigation.removeEventListener('navigate', hold));
	return loads;
}
