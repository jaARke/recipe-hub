import { del, list } from '@vercel/blob';
import type { PreviewStore, StoredImage } from './preview-folders';

// Vercel's example of deleting a store's blobs deletes 100 a request.
const deleteBatchSize = 100;

type Listing = {
	folders: string[];
	images: StoredImage[];
};

// The preview store through the Blob SDK, with the store's read-write token passed on every call,
// so no other credential the SDK could find takes its place.
export class BlobPreviewStore implements PreviewStore {
	private readonly token: string;

	constructor(token: string) {
		this.token = token;
	}

	async listFolders(prefix: string): Promise<string[]> {
		return (await this.listAll(prefix, 'folded')).folders;
	}

	async listImages(folder: string): Promise<StoredImage[]> {
		return (await this.listAll(folder, 'expanded')).images;
	}

	async delete(pathnames: readonly string[]): Promise<void> {
		for (let start = 0; start < pathnames.length; start += deleteBatchSize) {
			await del(pathnames.slice(start, start + deleteBatchSize), { token: this.token });
		}
	}

	// Page by page. Folded, the images inside each folder under the prefix come back as that folder.
	private async listAll(prefix: string, mode: 'folded' | 'expanded'): Promise<Listing> {
		const listing: Listing = { folders: [], images: [] };
		let cursor: string | undefined;
		do {
			const page = await list({ prefix, mode, cursor, token: this.token });
			listing.folders.push(...('folders' in page ? page.folders : []));
			listing.images.push(
				...page.blobs.map(({ pathname, uploadedAt }) => ({ pathname, uploadedAt }))
			);
			cursor = page.hasMore ? page.cursor : undefined;
		} while (cursor !== undefined);
		return listing;
	}
}
