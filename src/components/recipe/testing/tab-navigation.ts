import { vi } from 'vitest';

// Stands in for the Navigation API, since the test's frame cannot clear the history it has: the tab's
// history holds the URLs given, the last one current and shown in the address bar. Undo it with
// vi.unstubAllGlobals.
export function stubTabNavigation(urls: readonly string[]) {
	const entries = urls.map((url, index) => ({ url, index }));
	const events = new EventTarget();
	const navigation = {
		currentEntry: entries.at(-1) ?? null,
		entries: () => entries,
		addEventListener: (type: string, listener: () => void) =>
			events.addEventListener(type, listener),
		removeEventListener: (type: string, listener: () => void) =>
			events.removeEventListener(type, listener),
	};
	history.replaceState(null, '', navigation.currentEntry?.url);
	vi.stubGlobal('navigation', navigation);
	return {
		// Pushes an entry after the current one, which reports it at once, as a browser does.
		push(url: string) {
			const entry = { url, index: entries.length };
			entries.push(entry);
			navigation.currentEntry = entry;
			history.pushState(null, '', url);
			events.dispatchEvent(new Event('currententrychange'));
		},
	};
}
