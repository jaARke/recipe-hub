import { vi } from 'vitest';

// Stands in for the Navigation API, which happy-dom lacks: the tab's history holds the URLs given,
// the last one current and shown in the address bar. Undo it with vi.unstubAllGlobals.
export function stubTabNavigation(urls: readonly string[]) {
	const entries = urls.map((url, index) => ({ url, index }));
	const current = entries.at(-1);
	history.replaceState(null, '', current?.url);
	vi.stubGlobal('navigation', {
		currentEntry: current ?? null,
		entries: () => entries,
		addEventListener: () => {},
		removeEventListener: () => {},
	});
}
