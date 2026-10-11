import 'server-only';

export type StoredImage = {
	body: ReadableStream<Uint8Array>;
	contentType: string;
	etag: string;
};

export interface ImageStore {
	// Returns null when no image has this pathname.
	get(pathname: string): Promise<StoredImage | null>;
	has(pathname: string): Promise<boolean>;
	// Never overwrites: putting a pathname that is already taken fails.
	put(pathname: string, body: Uint8Array, contentType: string): Promise<void>;
}
