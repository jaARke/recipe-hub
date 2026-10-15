import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	memberBrowserStorageKey,
	readBrowserStorage,
	readTabStorage,
	removeBrowserStorage,
	removeMemberBrowserStorage,
	writeBrowserStorage,
	writeTabStorage,
} from '@/lib/browser-storage';

// Holds items in memory, as a browser's local and session storage do.
function memoryStorage(): Storage {
	const items = new Map<string, string>();
	return {
		get length() {
			return items.size;
		},
		clear: () => items.clear(),
		getItem: (key) => items.get(key) ?? null,
		key: (index) => [...items.keys()][index] ?? null,
		removeItem: (key) => {
			items.delete(key);
		},
		setItem: (key, value) => {
			items.set(key, value);
		},
	};
}

// A blocked browser refuses the page's storage itself, not just its items.
function blockStorage(area: 'localStorage' | 'sessionStorage') {
	Object.defineProperty(globalThis, area, {
		configurable: true,
		get() {
			throw new DOMException('The operation is insecure.', 'SecurityError');
		},
	});
}

afterEach(() => {
	vi.unstubAllGlobals();
	Reflect.deleteProperty(globalThis, 'localStorage');
	Reflect.deleteProperty(globalThis, 'sessionStorage');
});

describe('browser storage', () => {
	it('reads what it wrote, and nothing once it is removed', () => {
		vi.stubGlobal('localStorage', memoryStorage());

		expect(readBrowserStorage('recipe-form:new')).toBeUndefined();
		writeBrowserStorage('recipe-form:new', '{"title":"Lemon bars"}');
		expect(readBrowserStorage('recipe-form:new')).toBe('{"title":"Lemon bars"}');
		removeBrowserStorage('recipe-form:new');
		expect(readBrowserStorage('recipe-form:new')).toBeUndefined();
	});

	it('reads nothing, and writes and removes nothing, where a browser setting blocks storage', () => {
		blockStorage('localStorage');

		expect(readBrowserStorage('recipe-form:new')).toBeUndefined();
		expect(() => writeBrowserStorage('recipe-form:new', '{}')).not.toThrow();
		expect(() => removeBrowserStorage('recipe-form:new')).not.toThrow();
	});

	it('writes nothing, without throwing, once storage is full', () => {
		const storage = memoryStorage();
		storage.setItem = () => {
			throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
		};
		vi.stubGlobal('localStorage', storage);

		expect(() => writeBrowserStorage('recipe-form:new', '{}')).not.toThrow();
		expect(readBrowserStorage('recipe-form:new')).toBeUndefined();
	});

	it('removes everything kept for the member, and nothing else', () => {
		vi.stubGlobal('localStorage', memoryStorage());
		writeBrowserStorage(memberBrowserStorageKey('recipe-form:new'), '{}');
		writeBrowserStorage(memberBrowserStorageKey('recipe-form:import:1'), '{}');
		writeBrowserStorage('theme', 'dark');

		removeMemberBrowserStorage();

		expect(readBrowserStorage('member:recipe-form:new')).toBeUndefined();
		expect(readBrowserStorage('member:recipe-form:import:1')).toBeUndefined();
		expect(readBrowserStorage('theme')).toBe('dark');
	});

	it('reads nothing where there is no storage at all, as on the server', () => {
		expect(readBrowserStorage('recipe-form:new')).toBeUndefined();
		expect(() => writeBrowserStorage('recipe-form:new', '{}')).not.toThrow();
		expect(readTabStorage('opened-from:/recipes/lemon-bars')).toBeUndefined();
		expect(() => writeTabStorage('opened-from:/recipes/lemon-bars', '/')).not.toThrow();
	});
});

describe('tab storage', () => {
	it('reads what the tab wrote, kept apart from local storage', () => {
		vi.stubGlobal('localStorage', memoryStorage());
		vi.stubGlobal('sessionStorage', memoryStorage());

		expect(readTabStorage('opened-from:/recipes/lemon-bars')).toBeUndefined();
		writeTabStorage('opened-from:/recipes/lemon-bars', 'https://barbtable.com/favorites?page=2');

		expect(readTabStorage('opened-from:/recipes/lemon-bars')).toBe(
			'https://barbtable.com/favorites?page=2'
		);
		expect(readBrowserStorage('opened-from:/recipes/lemon-bars')).toBeUndefined();
	});

	it('reads nothing, and writes nothing, where a browser setting blocks storage', () => {
		blockStorage('sessionStorage');

		expect(readTabStorage('opened-from:/recipes/lemon-bars')).toBeUndefined();
		expect(() => writeTabStorage('opened-from:/recipes/lemon-bars', '/')).not.toThrow();
	});

	it('writes nothing, without throwing, once storage is full', () => {
		const storage = memoryStorage();
		storage.setItem = () => {
			throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
		};
		vi.stubGlobal('sessionStorage', storage);

		expect(() => writeTabStorage('opened-from:/recipes/lemon-bars', '/')).not.toThrow();
		expect(readTabStorage('opened-from:/recipes/lemon-bars')).toBeUndefined();
	});

	it('is left alone when signing out removes what was kept for the member', () => {
		vi.stubGlobal('localStorage', memoryStorage());
		vi.stubGlobal('sessionStorage', memoryStorage());
		writeTabStorage('opened-from:/recipes/lemon-bars', 'https://barbtable.com/');

		removeMemberBrowserStorage();

		expect(readTabStorage('opened-from:/recipes/lemon-bars')).toBe('https://barbtable.com/');
	});
});
