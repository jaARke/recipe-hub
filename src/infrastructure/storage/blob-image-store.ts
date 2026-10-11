import 'server-only';
import { BlobNotFoundError, get as getBlob, head as headBlob, put as putBlob } from '@vercel/blob';
import type { ImageStore, StoredImage } from '@/application/ports/image-store';

// Pathnames are never reused, so a stored image never changes.
const cacheMaxAgeSeconds = 365 * 24 * 60 * 60;

type BlobImageStoreOptions = {
	storeId: string;
};

// The SDK reads and refreshes Vercel's OIDC token itself; a token passed in is never refreshed.
export class BlobImageStore implements ImageStore {
	private readonly storeId: string;

	constructor(options: BlobImageStoreOptions) {
		this.storeId = options.storeId;
	}

	async get(pathname: string): Promise<StoredImage | null> {
		const result = await getBlob(pathname, { access: 'private', storeId: this.storeId });
		if (result === null) {
			return null;
		}

		// Only a conditional request can be answered with anything but the full image.
		if (result.statusCode !== 200) {
			throw new Error(`Blob read returned status ${result.statusCode}`);
		}

		return {
			body: result.stream,
			contentType: result.blob.contentType,
			etag: result.blob.etag,
		};
	}

	async has(pathname: string): Promise<boolean> {
		try {
			await headBlob(pathname, { storeId: this.storeId });
			return true;
		} catch (error) {
			if (error instanceof BlobNotFoundError) {
				return false;
			}
			throw error;
		}
	}

	async put(pathname: string, body: Uint8Array, contentType: string): Promise<void> {
		await putBlob(pathname, Buffer.from(body), {
			access: 'private',
			storeId: this.storeId,
			contentType,
			addRandomSuffix: false,
			allowOverwrite: false,
			cacheControlMaxAge: cacheMaxAgeSeconds,
		});
	}
}
