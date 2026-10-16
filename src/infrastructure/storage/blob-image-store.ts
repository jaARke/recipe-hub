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
import type {
	FailedImage,
	ImageMoveOutcome,
	ImageStore,
	RemovedImage,
	StoredImage,
} from '@/application/ports/image-store';
import type { ImageFolders } from '@/application/recipes/image-folders';
import { deadlineAfter, settleWithin } from '@/lib/deadline';
import { imageCacheMaxAgeSeconds, imageCacheTag, imageRouteSrc } from '@/lib/image-paths';

// A removed image moves here under its pathname, so each environment's removed images sit in its own
// folders under this one: trash/dish/production/<uuid>.jpg. The image route serves only dish/ and scan/.
const trashFolder = 'trash/';

// Vercel's example of deleting a store's blobs deletes 100 a request.
const deleteBatchSize = 100;

// Vercel's purge documentation allows 16 tags a call, and a source image is purged as its tag.
const purgeBatchSize = 16;

// Each Blob call gives up after this long, its retries included: the SDK retries a failed request with
// backoff from a second, so a call this slow has met an outage rather than a slow answer. A cache
// purge is held to the same bound.
const callTimeLimitMs = 15_000;

// Each call the store makes, as its time-out error names it.
type StoreCall =
	| 'Blob get'
	| 'Blob head'
	| 'Blob put'
	| 'Blob copy'
	| 'Blob list'
	| 'Blob delete'
	| 'Cache purge by tag'
	| 'Cache purge by source image';

type BlobImageStoreOptions = {
	storeId: string;
	// The only folders it lists, moves, and deletes in, so a deployment never touches another
	// environment's images.
	folders: ImageFolders;
};

type ListedBlob = {
	pathname: string;
	uploadedAt: Date;
};

// An image's move, named by the pathname it has outside the trash.
type Move = {
	pathname: string;
	from: string;
	to: string;
};

// What a move did: the images it moved, or found already gone, and those it left in place.
type MoveOutcome = {
	moved: string[];
	failed: FailedImage[];
};

// What purging did: the images whose cached copies it purged, and those it could not.
type PurgeOutcome = {
	purged: string[];
	failed: FailedImage[];
};

function trashPathname(pathname: string): string {
	return `${trashFolder}${pathname}`;
}

// The pathname a blob in the trash had before it was removed.
function pathnameBeforeTrash(trashedPathname: string): string {
	return trashedPathname.slice(trashFolder.length);
}

// Calls Blob or the cache, giving up once the call's time limit passes or the caller's signal aborts,
// and aborting a Blob request then; a purge takes no signal. Once the caller's signal has aborted, no
// call starts. A read that answered in time streams its body under the caller's signal alone.
async function withinTimeLimit<T>(
	call: StoreCall,
	request: (abortSignal: AbortSignal) => Promise<T>,
	cancellation?: AbortSignal
): Promise<T> {
	cancellation?.throwIfAborted();
	const abandoned = new AbortController();
	const abortSignal =
		cancellation === undefined
			? abandoned.signal
			: AbortSignal.any([abandoned.signal, cancellation]);
	try {
		return await settleWithin(
			request(abortSignal),
			{ deadline: deadlineAfter(callTimeLimitMs), cancellation },
			() => new Error(`${call} timed out after ${callTimeLimitMs / 1000} seconds`)
		);
	} catch (error) {
		abandoned.abort(error);
		throw error;
	}
}

// The images an error left undone, each with why: the error's name and message, which name a pathname
// at most, never an image's content. A signal that aborted stops the work instead.
function failuresOf(
	pathnames: readonly string[],
	error: unknown,
	signal?: AbortSignal
): FailedImage[] {
	if (signal?.aborted) {
		throw error;
	}

	return pathnames.map((pathname) => ({ pathname, reason: String(error) }));
}

function batches(pathnames: readonly string[], size: number): string[][] {
	const result: string[][] = [];
	for (let start = 0; start < pathnames.length; start += size) {
		result.push(pathnames.slice(start, start + size));
	}
	return result;
}

// Dish photos and scans alike are cached by Vercel's CDN and image optimizer. Each batch is purged on
// its own, so one whose purge fails is returned and the rest are still purged. Outside a Vercel
// request, as in a script or the dev server, the purges do nothing.
async function purgeCaches(
	pathnames: readonly string[],
	signal?: AbortSignal
): Promise<PurgeOutcome> {
	const outcome: PurgeOutcome = { purged: [], failed: [] };
	for (const batch of batches(pathnames, purgeBatchSize)) {
		try {
			await Promise.all([
				withinTimeLimit(
					'Cache purge by tag',
					() => dangerouslyDeleteByTag(batch.map(imageCacheTag)),
					signal
				),
				withinTimeLimit(
					'Cache purge by source image',
					() => dangerouslyDeleteBySrcImage(batch.map(imageRouteSrc)),
					signal
				),
			]);
			outcome.purged.push(...batch);
		} catch (error) {
			outcome.failed.push(...failuresOf(batch, error, signal));
		}
	}
	return outcome;
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
		const result = await withinTimeLimit(
			'Blob get',
			(abortSignal) =>
				getBlob(pathname, {
					access: 'private',
					storeId: this.storeId,
					useCache: false,
					abortSignal,
				}),
			signal
		);
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
			await withinTimeLimit('Blob head', (abortSignal) =>
				headBlob(pathname, { storeId: this.storeId, abortSignal })
			);
			return true;
		} catch (error) {
			if (error instanceof BlobNotFoundError) {
				return false;
			}
			throw error;
		}
	}

	async put(pathname: string, body: Uint8Array, contentType: string): Promise<void> {
		await withinTimeLimit('Blob put', (abortSignal) =>
			putBlob(pathname, Buffer.from(body), {
				access: 'private',
				storeId: this.storeId,
				contentType,
				addRandomSuffix: false,
				allowOverwrite: false,
				cacheControlMaxAge: imageCacheMaxAgeSeconds,
				abortSignal,
			})
		);
	}

	// Purged first too, so an image whose purge fails stays in place for the sweep to remove again, and
	// after the move for anything cached in between; a purge that fails then is reported against the
	// images it covered, which have moved.
	async remove(pathnames: readonly string[], signal?: AbortSignal): Promise<ImageMoveOutcome> {
		this.assertInFolders(pathnames);
		const before = await purgeCaches(pathnames, signal);
		const { moved, failed } = await this.move(
			before.purged.map((pathname) => ({ pathname, from: pathname, to: trashPathname(pathname) })),
			signal
		);
		const after = await purgeCaches(moved, signal);
		return { failed: [...before.failed, ...failed], unpurged: after.failed };
	}

	async listUploadedBefore(cutoff: Date, signal?: AbortSignal): Promise<string[]> {
		const blobs = await this.list(this.folders.environmentFolders(), signal);
		return blobs
			.filter(({ pathname, uploadedAt }) => this.folders.contains(pathname) && uploadedAt < cutoff)
			.map(({ pathname }) => pathname);
	}

	// The SDK stores a copy through the same request as an upload, so a removed image's uploadedAt is
	// when it was removed.
	async listRemoved(signal?: AbortSignal): Promise<RemovedImage[]> {
		const blobs = await this.list(this.folders.environmentFolders().map(trashPathname), signal);
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
	async restore(pathnames: readonly string[], signal?: AbortSignal): Promise<ImageMoveOutcome> {
		this.assertInFolders(pathnames);
		const { moved, failed } = await this.move(
			pathnames.map((pathname) => ({ pathname, from: trashPathname(pathname), to: pathname })),
			signal
		);
		const after = await purgeCaches(moved, signal);
		return { failed, unpurged: after.failed };
	}

	async deleteRemoved(pathnames: readonly string[], signal?: AbortSignal): Promise<void> {
		this.assertInFolders(pathnames);
		await this.delete(pathnames.map(trashPathname), signal);
	}

	private assertInFolders(pathnames: readonly string[]): void {
		if (!pathnames.every((pathname) => this.folders.contains(pathname))) {
			throw new Error("Images outside this environment's folders are never moved or deleted");
		}
	}

	// One image at a time, each copied before its own original is deleted, so an image that fails is
	// left in place, at both pathnames at worst, and the rest still move. A signal that aborts stops
	// the move rather than failing the image at hand.
	private async move(moves: readonly Move[], signal?: AbortSignal): Promise<MoveOutcome> {
		const outcome: MoveOutcome = { moved: [], failed: [] };
		for (const { pathname, from, to } of moves) {
			try {
				await this.copy(from, to, signal);
				await this.delete([from], signal);
				outcome.moved.push(pathname);
			} catch (error) {
				outcome.failed.push(...failuresOf([pathname], error, signal));
			}
		}
		return outcome;
	}

	// A copy takes neither the cache lifetime nor the content type of its source: the type comes from
	// the pathname's extension, as every upload is a .jpg. An interrupted move leaves the image at both
	// pathnames, so a copy may overwrite the same image, since pathnames are never reused. An image
	// already gone is skipped.
	private async copy(from: string, to: string, signal?: AbortSignal): Promise<void> {
		try {
			await withinTimeLimit(
				'Blob copy',
				(abortSignal) =>
					copyBlob(from, to, {
						access: 'private',
						storeId: this.storeId,
						addRandomSuffix: false,
						allowOverwrite: true,
						cacheControlMaxAge: imageCacheMaxAgeSeconds,
						abortSignal,
					}),
				signal
			);
		} catch (error) {
			if (!(error instanceof BlobNotFoundError)) {
				throw error;
			}
		}
	}

	// Each folder by its prefix, page by page, so nothing outside the folders is ever listed.
	private async list(prefixes: readonly string[], signal?: AbortSignal): Promise<ListedBlob[]> {
		const blobs: ListedBlob[] = [];
		for (const prefix of prefixes) {
			let cursor: string | undefined;
			do {
				const page = await withinTimeLimit(
					'Blob list',
					(abortSignal) => listBlobs({ prefix, cursor, storeId: this.storeId, abortSignal }),
					signal
				);
				blobs.push(...page.blobs.map(({ pathname, uploadedAt }) => ({ pathname, uploadedAt })));
				cursor = page.hasMore ? page.cursor : undefined;
			} while (cursor !== undefined);
		}
		return blobs;
	}

	private async delete(pathnames: readonly string[], signal?: AbortSignal): Promise<void> {
		for (const batch of batches(pathnames, deleteBatchSize)) {
			await withinTimeLimit(
				'Blob delete',
				(abortSignal) => deleteBlobs(batch, { storeId: this.storeId, abortSignal }),
				signal
			);
		}
	}
}
