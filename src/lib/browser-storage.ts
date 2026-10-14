// The one module that reads and writes the browser's local storage. A browser setting can block
// storage, and a full one refuses writes, so a blocked access only turns off what uses it: a read
// finds nothing, and a write or removal does nothing. Safari deletes what a page's script stores
// after seven days without a visit, so what is kept here is never the only copy that matters.

// What is kept for whoever is signed in, such as a form's unsaved changes, so signing out removes it.
const memberKeyPrefix = 'member:';

// The access, or undefined where storage is blocked, absent, or full.
function attempt<T>(access: (storage: Storage) => T): T | undefined {
	try {
		return access(localStorage);
	} catch {
		return undefined;
	}
}

export function readBrowserStorage(key: string): string | undefined {
	return attempt((storage) => storage.getItem(key)) ?? undefined;
}

export function writeBrowserStorage(key: string, value: string): void {
	attempt((storage) => storage.setItem(key, value));
}

export function removeBrowserStorage(key: string): void {
	attempt((storage) => storage.removeItem(key));
}

// A key for something kept for the member signed in, which signing out removes.
export function memberBrowserStorageKey(name: string): string {
	return `${memberKeyPrefix}${name}`;
}

// Removes everything kept for the member, as signing out does, so the next person on a shared device
// finds none of it.
export function removeMemberBrowserStorage(): void {
	attempt((storage) => {
		const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index));
		for (const key of keys) {
			if (key?.startsWith(memberKeyPrefix) === true) {
				storage.removeItem(key);
			}
		}
	});
}
