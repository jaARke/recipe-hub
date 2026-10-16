import 'server-only';
import {
	BlobNotFoundError,
	copy as copyBlob,
	del as deleteBlobs,
	get as getBlob,
	head as headBlob,
	list as listBlobs,
	put as putBlob,
} from '@vercel/blob';
import { dangerouslyDeleteBySrcImage, dangerouslyDeleteByTag } from '@vercel/functions';
import type { ImageStore, RemovedImage, StoredImage } from '@/application/ports/image-store';
import type { ImageFolders } from '@/application/recipes/image-folders';
import { imageCacheMaxAgeSeconds, imageCacheTag, imageRouteSrc } from '@/lib/image-paths';

// A removed image moves here under its pathname, so each environment's removed images sit in its own
// folders under this one: trash/dish/production/<uuid>.jpg. The image route serves only dish/ and scan/.
const trashFolder = 'trash/';

// Vercel's example of deleting a store's blobs deletes 100 a request.
const deleteBatchSize = 100;

type BlobImageStoreOptions = {
	storeId: string;
	// The only folders it lists, moves, and deletes in, so a deployment never touches another
	// environment's images but the old ones in the expiring environments' folders.
	folders: ImageFolders;
};

type ListedBlob = {
	pathname: string;
	uploadedAt: Date;
};

type Move = {
	from: string;
	to: string;
};

function trashPathname(pathname: string): string {
	return `${trashFolder}${pathname}`;
}

// The pathname a blob in the trash had before it was removed.
function pathnameBeforeTrash(trashedPathname: string): string {
	return trashedPathname.slice(trashFolder.length);
}

function batches(pathnames: readonly string[]): string[][] {
	const result: string[][] = [];
	for (let start = 0; start < pathnames.length; start += deleteBatchSize) {
		result.push(pathnames.slice(start, start + deleteBatchSize));
	}
	return result;
}

// Dish photos and scans alike are cached by Vercel's CDN and image optimizer. Outside a Vercel
// request, as in a script or the dev server, the purges do nothing.
async function purgeCaches(pathnames: readonly string[]): Promise<void> {
	if (pathnames.length > 0) {
		await Promise.all([
			dangerouslyDeleteByTag(pathnames.map(imageCacheTag)),
			dangerouslyDeleteBySrcImage(pathnames.map(imageRouteSrc)),
		]);
	}
}

// The SDK reads and refreshes Vercel's OIDC token itself; a token passed in is never refreshed.
export class BlobImageStore implements ImageStore {
	private readonly storeId: string;
	private readonly folders: ImageFolders;

	constructor(options: BlobImageStoreOptions) {
		this.storeId = options.storeId;
		this.folders = options.folders;
	}

	// The signal reaches the read's fetch, so it stops the body's stream too.
	async get(pathname: string, signal?: AbortSignal): Promise<StoredImage | null> {
		// Past Blob's cache, so an image removed moments ago is not served and cached for another year.
		const result = await getBlob(pathname, {
			access: 'private',
			storeId: this.storeId,
			useCache: false,
			abortSignal: signal,
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

	// Purged first too, so a purge that fails leaves the image in place for the sweep to remove again,
	// and after the move for anything cached in between.
	async remove(pathnames: readonly string[]): Promise<void> {
		this.assertInFolders(pathnames);
		await purgeCaches(pathnames);
		await this.move(pathnames.map((pathname) => ({ from: pathname, to: trashPathname(pathname) })));
		await purgeCaches(pathnames);
	}

	async listUploadedBefore(cutoff: Date): Promise<string[]> {
		const blobs = await this.list(this.folders.environmentFolders());
		return blobs
			.filter(({ pathname, uploadedAt }) => this.folders.contains(pathname) && uploadedAt < cutoff)
			.map(({ pathname }) => pathname);
	}

	// The SDK stores a copy through the same request as an upload, so a removed image's uploadedAt is
	// when it was removed.
	async listRemoved(): Promise<RemovedImage[]> {
		const blobs = await this.list(this.folders.environmentFolders().map(trashPathname));
		return blobs
			.map(({ pathname, uploadedAt }) => ({
				pathname: pathnameBeforeTrash(pathname),
				removedAt: uploadedAt,
			}))
			.filter(({ pathname }) => this.folders.contains(pathname));
	}

	async hasRemoved(pathname: string): Promise<boolean> {
		return this.has(trashPathname(pathname));
	}

	// A restored photo may have been asked for while it was removed, so its caches are purged again.
	async restore(pathnames: readonly string[]): Promise<void> {
		this.assertInFolders(pathnames);
		await this.move(pathnames.map((pathname) => ({ from: trashPathname(pathname), to: pathname })));
		await purgeCaches(pathnames);
	}

	async deleteRemoved(pathnames: readonly string[]): Promise<void> {
		this.assertInFolders(pathnames);
		await this.delete(pathnames.map(trashPathname));
	}

	// A removed image's uploadedAt is when it was removed, so each copy goes by its own date. Nothing is
	// purged: production, which expires these folders, never serves them, and a preview's cached copies
	// are test data behind its deployment's protection that leave with its deployments.
	async deleteExpired(cutoff: Date): Promise<string[]> {
		const folders = this.folders.expiringFolders();
		const [stored, removed] = await Promise.all([
			this.list(folders),
			this.list(folders.map(trashPathname)),
		]);
		const isExpired = ({ pathname, uploadedAt }: ListedBlob) =>
			this.folders.isExpiring(pathname) && uploadedAt < cutoff;
		const storedPathnames = stored.filter(isExpired).map(({ pathname }) => pathname);
		const removedPathnames = removed
			.map(({ pathname, uploadedAt }) => ({ pathname: pathnameBeforeTrash(pathname), uploadedAt }))
			.filter(isExpired)
			.map(({ pathname }) => pathname);
		await this.delete([...storedPathnames, ...removedPathnames.map(trashPathname)]);
		return [...storedPathnames, ...removedPathnames];
	}

	private assertInFolders(pathnames: readonly string[]): void {
		if (!pathnames.every((pathname) => this.folders.contains(pathname))) {
			throw new Error("Images outside this environment's folders are never moved or deleted");
		}
	}

	// Copies every image before deleting any original, so a failed move loses nothing.
	private async move(moves: readonly Move[]): Promise<void> {
		for (const { from, to } of moves) {
			await this.copy(from, to);
		}
		await this.delete(moves.map(({ from }) => from));
	}

	// A copy takes neither the cache lifetime nor the content type of its source: the type comes from
	// the pathname's extension, as every upload is a .jpg. An interrupted move leaves the image at both
	// pathnames, so a copy may overwrite the same image, since pathnames are never reused. An image
	// already gone is skipped.
	private async copy(from: string, to: string): Promise<void> {
		try {
			await copyBlob(from, to, {
				access: 'private',
				storeId: this.storeId,
				addRandomSuffix: false,
				allowOverwrite: true,
				cacheControlMaxAge: imageCacheMaxAgeSeconds,
			});
		} catch (error) {
			if (!(error instanceof BlobNotFoundError)) {
				throw error;
			}
		}
	}

	// Each folder by its prefix, page by page, so nothing outside the folders is ever listed.
	private async list(prefixes: readonly string[]): Promise<ListedBlob[]> {
		const blobs: ListedBlob[] = [];
		for (const prefix of prefixes) {
			let cursor: string | undefined;
			do {
				const page = await listBlobs({ prefix, cursor, storeId: this.storeId });
				blobs.push(...page.blobs.map(({ pathname, uploadedAt }) => ({ pathname, uploadedAt })));
				cursor = page.hasMore ? page.cursor : undefined;
			} while (cursor !== undefined);
		}
		return blobs;
	}

	private async delete(pathnames: readonly string[]): Promise<void> {
		for (const batch of batches(pathnames)) {
			await deleteBlobs(batch, { storeId: this.storeId });
		}
	}
}
