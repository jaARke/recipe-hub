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
import {
	ImageMoveInterruptedError,
	type FailedImage,
	type ImageMoveOutcome,
	type ImageStore,
	type RemovedImage,
	type StoredImage,
} from '@/application/ports/image-store';
import type { ImageFolders } from '@/application/recipes/image-folders';
import { deadlineAfter, requestWithin, settleWithin } from '@/lib/deadline';
import {
	imageCacheMaxAgeSeconds,
	imageCacheTag,
	imageRouteSrc,
	trashFolder,
} from '@/lib/image-paths';

// Vercel's example of deleting a store's blobs deletes 100 a request.
const deleteBatchSize = 100;

// Vercel's purge documentation allows 16 tags a call, and a source image is purged as its tag.
const purgeBatchSize = 16;

// Each Blob call gives up after this long, its retries included: the SDK retries a failed request with
// backoff from a second, so a call this slow has met an outage rather than a slow answer. A cache
// purge is held to the same bound.
const callTimeLimitMs = 15_000;

// The purge after a move ends after this long, however many batches it has left, as no signal stops
// it. A move still purges once the image move's 60-second bound has passed, so this bounds how far
// past it the move runs, leaving the cleanup cron's 120 seconds room for its other steps and its
// answer. It lets one batch use its whole call limit and leaves time for more.
const purgeAfterMoveTimeLimitMs = 20_000;

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

// What purging did: the images whose cached copies it purged, and those it could not.
type PurgeOutcome = {
	purged: string[];
	failed: FailedImage[];
};

// What ends a purge early besides each call's time limit: the caller's signal before a move, which
// stops it, rejecting with its reason, and the deadline of a purge after a move, past which the batch
// at hand and those after it are returned as failed.
type PurgeLimits = {
	cancellation?: AbortSignal;
	deadline?: AbortSignal;
};

function trashPathname(pathname: string): string {
	return `${trashFolder}${pathname}`;
}

// The pathname a blob in the trash had before it was removed.
function pathnameBeforeTrash(trashedPathname: string): string {
	return trashedPathname.slice(trashFolder.length);
}

// Calls Blob or the cache within the call's time limit and the caller's signal, aborting a Blob request
// that is given up on; a purge takes no signal.
function withinTimeLimit<T>(
	call: StoreCall,
	request: (abortSignal: AbortSignal) => Promise<T>,
	cancellation?: AbortSignal
): Promise<T> {
	return requestWithin(
		request,
		{ timeLimitMs: callTimeLimitMs, cancellation },
		() => new Error(`${call} timed out after ${callTimeLimitMs / 1000} seconds`)
	);
}

function purgeAfterMoveTimedOut(): Error {
	return new Error(
		`The purge after the move timed out after ${purgeAfterMoveTimeLimitMs / 1000} seconds`
	);
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
// its own, so one whose purge fails is returned and the rest are still purged; none starts once the
// deadline has passed, and one it cuts off is left running, as a purge takes no signal. Outside a
// Vercel request, as in a script or the dev server, the purges do nothing.
async function purgeCaches(
	pathnames: readonly string[],
	{ cancellation, deadline }: PurgeLimits
): Promise<PurgeOutcome> {
	const outcome: PurgeOutcome = { purged: [], failed: [] };
	for (const batch of batches(pathnames, purgeBatchSize)) {
		try {
			if (deadline?.aborted) {
				throw purgeAfterMoveTimedOut();
			}

			const purge = Promise.all([
				withinTimeLimit(
					'Cache purge by tag',
					() => dangerouslyDeleteByTag(batch.map(imageCacheTag)),
					cancellation
				),
				withinTimeLimit(
					'Cache purge by source image',
					() => dangerouslyDeleteBySrcImage(batch.map(imageRouteSrc)),
					cancellation
				),
			]);
			await (deadline === undefined
				? purge
				: settleWithin(purge, { deadline }, purgeAfterMoveTimedOut));
			outcome.purged.push(...batch);
		} catch (error) {
			outcome.failed.push(...failuresOf(batch, error, cancellation));
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

	// Purged first too, so an image whose purge fails stays in place for the sweep to remove again.
	async remove(pathnames: readonly string[], signal?: AbortSignal): Promise<ImageMoveOutcome> {
		this.assertInFolders(pathnames);
		const before = await purgeCaches(pathnames, { cancellation: signal });
		const { failed, unpurged } = await this.move(
			before.purged.map((pathname) => ({ pathname, from: pathname, to: trashPathname(pathname) })),
			signal
		);
		return { failed: [...before.failed, ...failed], unpurged };
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
		return this.move(
			pathnames.map((pathname) => ({ pathname, from: trashPathname(pathname), to: pathname })),
			signal
		);
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
	// the move at the image at hand rather than failing it. Every image whose copy succeeded is then
	// purged however the move ended, as a request during the move can cache an image for a year, within
	// the purge's own time limit, which no signal stops; a batch that fails or that the limit cuts off
	// is reported against the images it covered. So an image whose delete fails or times out is returned
	// as failed and still purged, and one whose delete the signal stops is purged too: Blob may have
	// deleted the original before its answer was lost, and the SDK retries a request it had no answer
	// to, so no failure proves the original remains.
	private async move(moves: readonly Move[], signal?: AbortSignal): Promise<ImageMoveOutcome> {
		const copied: string[] = [];
		const failed: FailedImage[] = [];
		let stoppedBy: { reason: unknown } | undefined;
		for (const { pathname, from, to } of moves) {
			try {
				await this.copy(from, to, signal);
				copied.push(pathname);
				await this.delete([from], signal);
			} catch (error) {
				if (signal?.aborted) {
					stoppedBy = { reason: signal.reason };
					break;
				}
				failed.push(...failuresOf([pathname], error));
			}
		}

		const after = await purgeCaches(copied, {
			deadline: deadlineAfter(purgeAfterMoveTimeLimitMs),
		});
		if (stoppedBy !== undefined) {
			throw new ImageMoveInterruptedError(after.failed, { cause: stoppedBy.reason });
		}
		return { failed, unpurged: after.failed };
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
