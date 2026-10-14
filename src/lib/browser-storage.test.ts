import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	memberBrowserStorageKey,
	readBrowserStorage,
	removeBrowserStorage,
	removeMemberBrowserStorage,
	writeBrowserStorage,
} from '@/lib/browser-storage';

// Holds items in memory, as a browser's local storage does.
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

afterEach(() => {
	vi.unstubAllGlobals();
	Reflect.deleteProperty(globalThis, 'localStorage');
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
		// A blocked browser refuses the page's storage itself, not just its items.
		Object.defineProperty(globalThis, 'localStorage', {
			configurable: true,
			get() {
				throw new DOMException('The operation is insecure.', 'SecurityError');
			},
		});

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
	});
});
