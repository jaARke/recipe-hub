// The one module that reads and writes the browser's storage: local storage, which the browser
// keeps, and session storage, which one tab keeps until it closes. A browser setting can block
// storage, and a full one refuses writes, so a blocked access only turns off what uses it: a read
// finds nothing, and a write or removal does nothing. Safari deletes what a page's script stores
// after seven days without a visit, so what is kept here is never the only copy that matters.

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

// Removes each entry under the prefix whose value the check finds stale, such as progress past its
// lifetime for a page this device never opens again.
export function removeBrowserStorageWhere(
	prefix: string,
	isStale: (value: string) => boolean
): void {
	attempt('localStorage', (storage) => {
		const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index));
		for (const key of keys) {
			const value = key?.startsWith(prefix) === true ? storage.getItem(key) : null;
			if (key !== null && value !== null && isStale(value)) {
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

// What this tab keeps until it closes, such as where each recipe was opened from. A browser may
// copy it into a tab opened from this one.
export function readTabStorage(key: string): string | undefined {
	return attempt('sessionStorage', (storage) => storage.getItem(key)) ?? undefined;
}

export function writeTabStorage(key: string, value: string): void {
	attempt('sessionStorage', (storage) => storage.setItem(key, value));
}
