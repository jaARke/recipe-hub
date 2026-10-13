import 'server-only';

export type StoredImage = {
	body: ReadableStream<Uint8Array>;
	contentType: string;
	etag: string;
};

// A removed image, by the pathname it had.
export type RemovedImage = {
	pathname: string;
	removedAt: Date;
};

// Every operation but get, has, hasRemoved, put, and deleteExpired stays inside this environment's
// folders; deleteExpired stays inside the expiring environments' folders.
export interface ImageStore {
	// Returns null when no image has this pathname. The read and its body stop once the signal aborts.
	get(pathname: string, signal?: AbortSignal): Promise<StoredImage | null>;
	has(pathname: string): Promise<boolean>;
	// Never overwrites: putting a pathname that is already taken fails.
	put(pathname: string, body: Uint8Array, contentType: string): Promise<void>;
	// Moves the images aside, where each is kept until it is restored or deleted for good, and purges
	// anything cached from them. An image already gone is skipped.
	remove(pathnames: readonly string[]): Promise<void>;
	// The pathnames of this environment's images uploaded before the given time, never removed ones.
	listUploadedBefore(cutoff: Date): Promise<string[]>;
	listRemoved(): Promise<RemovedImage[]>;
	// Whether a removed image still holds the pathname, so it could be restored there.
	hasRemoved(pathname: string): Promise<boolean>;
	// Moves removed images back to their pathnames, skipping any already gone, and purges anything
	// cached from them.
	restore(pathnames: readonly string[]): Promise<void>;
	// Deletes removed images for good.
	deleteRemoved(pathnames: readonly string[]): Promise<void>;
	// Deletes for good the images in the expiring environments' folders uploaded before the cutoff, and
	// the removed ones there removed before it, and returns the pathnames they had. It purges no caches,
	// since the deployment that expires those folders never serves them.
	deleteExpired(cutoff: Date): Promise<string[]>;
}
