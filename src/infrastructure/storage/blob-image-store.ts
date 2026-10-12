import 'server-only';
import {
	BlobNotFoundError,
	del as deleteBlobs,
	get as getBlob,
	head as headBlob,
	put as putBlob,
} from '@vercel/blob';
import { dangerouslyDeleteBySrcImage, dangerouslyDeleteByTag } from '@vercel/functions';
import type { ImageStore, StoredImage } from '@/application/ports/image-store';
import type { ImageFolders } from '@/application/recipes/image-folders';
import { isPublicImagePathname } from '@/domain/recipe/recipe-image';
import { imageCacheMaxAgeSeconds, imageCacheTag, imageRouteSrc } from '@/lib/image-paths';

type BlobImageStoreOptions = {
	storeId: string;
	// The only folders it deletes from, so a deployment never deletes another environment's images.
	folders: ImageFolders;
};

// The SDK reads and refreshes Vercel's OIDC token itself; a token passed in is never refreshed.
export class BlobImageStore implements ImageStore {
	private readonly storeId: string;
	private readonly folders: ImageFolders;

	constructor(options: BlobImageStoreOptions) {
		this.storeId = options.storeId;
		this.folders = options.folders;
	}

	async get(pathname: string): Promise<StoredImage | null> {
		// Past Blob's cache, so an image deleted moments ago is not served and cached for another year.
		const result = await getBlob(pathname, {
			access: 'private',
			storeId: this.storeId,
			useCache: false,
		});
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
			cacheControlMaxAge: imageCacheMaxAgeSeconds,
		});
	}

	// Dish photos are cached by Vercel's CDN and image optimizer, which are purged too. Outside a
	// Vercel request, as in a script or the dev server, the purges do nothing.
	async delete(pathnames: readonly string[]): Promise<void> {
		if (!pathnames.every((pathname) => this.folders.contains(pathname))) {
			throw new Error("Images outside this environment's folders are never deleted");
		}

		await deleteBlobs([...pathnames], { storeId: this.storeId });
		const dishPhotos = pathnames.filter(isPublicImagePathname);
		if (dishPhotos.length > 0) {
			await Promise.all([
				dangerouslyDeleteByTag(dishPhotos.map(imageCacheTag)),
				dangerouslyDeleteBySrcImage(dishPhotos.map(imageRouteSrc)),
			]);
		}
	}
}
