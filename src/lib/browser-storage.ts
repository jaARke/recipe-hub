// The one module through which the site's own code reads and writes the browser's storage: local
// storage, which the browser keeps, and session storage, which one tab keeps until it closes. Two
// libraries keep local storage entries of their own outside it: next-themes the theme picked
// (`theme`), and Better Auth its notice to other tabs of a sign-in or sign-out
// (`better-auth.message`). A browser setting can block storage, and a full one refuses writes, so a
// blocked access only turns off what uses it: a read finds nothing, and a write or removal does
// nothing. Safari deletes what a page's script stores after seven days without a visit, so what is
// kept here is never the only copy that matters.

// What is kept for whoever is signed in, such as a form's unsaved changes, so signing out removes it.
const memberKeyPrefix = 'member:';

type StorageArea = 'localStorage' | 'sessionStorage';

// The access, or undefined where storage is blocked, absent, or full.
function attempt<T>(area: StorageArea, access: (storage: Storage) => T): T | undefined {
	try {
		return access(globalThis[area]);
	} catch {
		return undefined;
	}
}

export function readBrowserStorage(key: string): string | undefined {
	return attempt('localStorage', (storage) => storage.getItem(key)) ?? undefined;
}

export function writeBrowserStorage(key: string, value: string): void {
	attempt('localStorage', (storage) => storage.setItem(key, value));
}

export function removeBrowserStorage(key: string): void {
	attempt('localStorage', (storage) => storage.removeItem(key));
}

// A key for something kept for the member signed in, which signing out removes.
export function memberBrowserStorageKey(name: string): string {
	return `${memberKeyPrefix}${name}`;
}

// Removes each entry under the prefix that the check finds stale by its value and key, such as one
// past its lifetime for a page this device never opens again.
export function removeBrowserStorageWhere(
	prefix: string,
	isStale: (value: string, key: string) => boolean
): void {
	attempt('localStorage', (storage) => {
		const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index));
		for (const key of keys) {
			const value = key?.startsWith(prefix) === true ? storage.getItem(key) : null;
			if (key !== null && value !== null && isStale(value, key)) {
				storage.removeItem(key);
			}
		}
	});
}

// Removes everything kept for the member, as signing out does, so the next person on a shared device
// finds none of it.
export function removeMemberBrowserStorage(): void {
	removeBrowserStorageWhere(memberKeyPrefix, () => true);
}

// What this tab keeps until it closes, such as where each recipe was opened from and the cooking
// view's checks. A browser may copy it into a tab opened from this one.
export function readTabStorage(key: string): string | undefined {
	return attempt('sessionStorage', (storage) => storage.getItem(key)) ?? undefined;
}

export function writeTabStorage(key: string, value: string): void {
	attempt('sessionStorage', (storage) => storage.setItem(key, value));
}

export function removeTabStorage(key: string): void {
	attempt('sessionStorage', (storage) => storage.removeItem(key));
}
