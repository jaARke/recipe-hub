import type {
	FailedImage,
	ImageMoveOutcome,
	ImageStore,
	RemovedImage,
	StoredImage,
} from '@/application/ports/image-store';
import type { ImageFolders } from '@/application/recipes/image-folders';
import { stalledCall } from '@/application/testing/stalled-call';

type InMemoryImage = {
	body: Uint8Array;
	contentType: string;
	etag: string;
	uploadedAt: Date;
};

type RemovedInMemoryImage = {
	image: InMemoryImage;
	removedAt: Date;
};

// Why a move left an image a test made unmovable, as Blob gives a copy that fails.
const unmovableReason = 'Error: The image could not be copied';

// Why a move could not purge the caches of an image a test made unpurgeable, as the CDN gives.
const unpurgeableReason = 'Error: The cache purge failed';

// An environment's store, which may also hold images outside the folders it works in, as the preview
// store holds every preview's. It records whether it was read, so tests can prove that refused
// pathnames never reach the store, and
// what it removed. A test can make removing fail, one image's moves or purges fail, or reading or
// moving stall, as an unreachable store would.
export class InMemoryImageStore implements ImageStore {
	private readonly images = new Map<string, InMemoryImage>();
	private readonly removed = new Map<string, RemovedInMemoryImage>();
	private readonly removedHistory: string[] = [];
	private readonly unmovable = new Set<string>();
	private readonly unpurgeable = new Set<string>();
	private readonly folders: ImageFolders;
	private read = false;
	private removesFail = false;
	private readsStall = false;
	private movesStall = false;

	// The folders that listing, removing, restoring, and deleting stay inside.
	constructor(folders: ImageFolders) {
		this.folders = folders;
	}

	get wasRead(): boolean {
		return this.read;
	}

	// Every pathname it was asked to remove, in order.
	get removedPathnames(): readonly string[] {
		return this.removedHistory;
	}

	failRemoves(): void {
		this.removesFail = true;
	}

	// Moving this image aside or back then fails, as a copy Blob refuses does, while others still move.
	failMovesOf(pathname: string): void {
		this.unmovable.add(pathname);
	}

	// Purging this image's caches once it has moved aside or back then fails, as an unreachable CDN's
	// does, while the image stays moved.
	failPurgesOf(pathname: string): void {
		this.unpurgeable.add(pathname);
	}

	// Reads then never answer, and stop only when their signal aborts.
	stallReads(): void {
		this.readsStall = true;
	}

	// Removing and restoring then never answer, and stop only when their signal aborts.
	stallMoves(): void {
		this.movesStall = true;
	}

	// Stands in for an image uploaded at an earlier time.
	backdateUpload(pathname: string, uploadedAt: Date): void {
		const image = this.images.get(pathname);
		if (image === undefined) {
			throw new Error('No image has this pathname');
		}

		this.images.set(pathname, { ...image, uploadedAt });
	}

	// Stands in for an image removed at an earlier time.
	backdateRemoval(pathname: string, removedAt: Date): void {
		const removed = this.removed.get(pathname);
		if (removed === undefined) {
			throw new Error('No removed image has this pathname');
		}

		this.removed.set(pathname, { ...removed, removedAt });
	}

	async get(pathname: string, signal?: AbortSignal): Promise<StoredImage | null> {
		this.read = true;
		if (this.readsStall) {
			return stalledCall(signal);
		}

		signal?.throwIfAborted();
		const image = this.images.get(pathname);
		if (image === undefined) {
			return null;
		}

		return {
			body: new ReadableStream({
				start(controller) {
					controller.enqueue(image.body);
					controller.close();
				},
			}),
			contentType: image.contentType,
			etag: image.etag,
		};
	}

	async has(pathname: string): Promise<boolean> {
		return this.images.has(pathname);
	}

	async put(pathname: string, body: Uint8Array, contentType: string): Promise<void> {
		if (this.images.has(pathname)) {
			throw new Error('An image is already stored at this pathname');
		}

		this.images.set(pathname, {
			body,
			contentType,
			etag: crypto.randomUUID(),
			uploadedAt: new Date(),
		});
	}

	async remove(pathnames: readonly string[], signal?: AbortSignal): Promise<ImageMoveOutcome> {
		this.assertInFolders(pathnames);
		if (this.movesStall) {
			return stalledCall(signal);
		}
		signal?.throwIfAborted();
		if (this.removesFail) {
			throw new Error('The image store could not be reached');
		}

		const failed: FailedImage[] = [];
		for (const pathname of pathnames) {
			this.removedHistory.push(pathname);
			if (this.unmovable.has(pathname)) {
				failed.push({ pathname, reason: unmovableReason });
				continue;
			}

			const image = this.images.get(pathname);
			if (image !== undefined) {
				this.images.delete(pathname);
				this.removed.set(pathname, { image, removedAt: new Date() });
			}
		}
		return { failed, unpurged: this.unpurgedOf(pathnames) };
	}

	async listUploadedBefore(cutoff: Date, signal?: AbortSignal): Promise<string[]> {
		signal?.throwIfAborted();
		return [...this.images]
			.filter(([pathname, image]) => this.folders.contains(pathname) && image.uploadedAt < cutoff)
			.map(([pathname]) => pathname);
	}

	async listRemoved(signal?: AbortSignal): Promise<RemovedImage[]> {
		signal?.throwIfAborted();
		return [...this.removed]
			.filter(([pathname]) => this.folders.contains(pathname))
			.map(([pathname, { removedAt }]) => ({ pathname, removedAt }));
	}

	async hasRemoved(pathname: string): Promise<boolean> {
		return this.removed.has(pathname);
	}

	// A restored image counts as uploaded now, as Blob stores it again.
	async restore(pathnames: readonly string[], signal?: AbortSignal): Promise<ImageMoveOutcome> {
		this.assertInFolders(pathnames);
		if (this.movesStall) {
			return stalledCall(signal);
		}
		signal?.throwIfAborted();

		const failed: FailedImage[] = [];
		for (const pathname of pathnames) {
			if (this.unmovable.has(pathname)) {
				failed.push({ pathname, reason: unmovableReason });
				continue;
			}

			const removed = this.removed.get(pathname);
			if (removed !== undefined) {
				this.removed.delete(pathname);
				this.images.set(pathname, { ...removed.image, uploadedAt: new Date() });
			}
		}
		return { failed, unpurged: this.unpurgedOf(pathnames) };
	}

	async deleteRemoved(pathnames: readonly string[], signal?: AbortSignal): Promise<void> {
		this.assertInFolders(pathnames);
		signal?.throwIfAborted();
		for (const pathname of pathnames) {
			this.removed.delete(pathname);
		}
	}

	// The moved images whose caches a test made unpurgeable.
	private unpurgedOf(pathnames: readonly string[]): FailedImage[] {
		return pathnames
			.filter((pathname) => this.unpurgeable.has(pathname) && !this.unmovable.has(pathname))
			.map((pathname) => ({ pathname, reason: unpurgeableReason }));
	}

	// As the Blob adapter refuses them.
	private assertInFolders(pathnames: readonly string[]): void {
		if (!pathnames.every((pathname) => this.folders.contains(pathname))) {
			throw new Error("Images outside this environment's folders are never moved or deleted");
		}
	}
}
