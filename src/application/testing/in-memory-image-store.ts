import type { ImageStore, RemovedImage, StoredImage } from '@/application/ports/image-store';
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

// Every environment's images, stored and removed, as the one Blob store holds them.
type InMemoryImages = {
	stored: Map<string, InMemoryImage>;
	removed: Map<string, RemovedInMemoryImage>;
};

// One environment's view of the store, which also holds other environments' images, as Blob does. It
// records whether it was read, so tests can prove that refused pathnames never reach the store, and
// what it removed. A test can make removing fail, or reading stall, as an unreachable store would.
export class InMemoryImageStore implements ImageStore {
	private readonly images: Map<string, InMemoryImage>;
	private readonly removed: Map<string, RemovedInMemoryImage>;
	private readonly removedHistory: string[] = [];
	private readonly folders: ImageFolders;
	private read = false;
	private removesFail = false;
	private readsStall = false;

	// The folders that listing, removing, restoring, and deleting stay inside.
	constructor(
		folders: ImageFolders,
		images: InMemoryImages = { stored: new Map(), removed: new Map() }
	) {
		this.folders = folders;
		this.images = images.stored;
		this.removed = images.removed;
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

	// Reads then never answer, and stop only when their signal aborts.
	stallReads(): void {
		this.readsStall = true;
	}

	// Another environment's view of the same images, as another deployment sees the one store.
	viewAs(folders: ImageFolders): InMemoryImageStore {
		return new InMemoryImageStore(folders, { stored: this.images, removed: this.removed });
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

	async remove(pathnames: readonly string[]): Promise<void> {
		this.assertInFolders(pathnames);
		if (this.removesFail) {
			throw new Error('The image store could not be reached');
		}

		for (const pathname of pathnames) {
			const image = this.images.get(pathname);
			if (image !== undefined) {
				this.images.delete(pathname);
				this.removed.set(pathname, { image, removedAt: new Date() });
			}
			this.removedHistory.push(pathname);
		}
	}

	async listUploadedBefore(cutoff: Date): Promise<string[]> {
		return [...this.images]
			.filter(([pathname, image]) => this.folders.contains(pathname) && image.uploadedAt < cutoff)
			.map(([pathname]) => pathname);
	}

	async listRemoved(): Promise<RemovedImage[]> {
		return [...this.removed]
			.filter(([pathname]) => this.folders.contains(pathname))
			.map(([pathname, { removedAt }]) => ({ pathname, removedAt }));
	}

	async hasRemoved(pathname: string): Promise<boolean> {
		return this.removed.has(pathname);
	}

	// A restored image counts as uploaded now, as Blob stores it again.
	async restore(pathnames: readonly string[]): Promise<void> {
		this.assertInFolders(pathnames);
		for (const pathname of pathnames) {
			const removed = this.removed.get(pathname);
			if (removed !== undefined) {
				this.removed.delete(pathname);
				this.images.set(pathname, { ...removed.image, uploadedAt: new Date() });
			}
		}
	}

	async deleteRemoved(pathnames: readonly string[]): Promise<void> {
		this.assertInFolders(pathnames);
		for (const pathname of pathnames) {
			this.removed.delete(pathname);
		}
	}

	async deleteExpired(cutoff: Date): Promise<string[]> {
		const stored = [...this.images]
			.filter(([pathname, image]) => this.folders.isExpiring(pathname) && image.uploadedAt < cutoff)
			.map(([pathname]) => pathname);
		const removed = [...this.removed]
			.filter(
				([pathname, { removedAt }]) => this.folders.isExpiring(pathname) && removedAt < cutoff
			)
			.map(([pathname]) => pathname);
		for (const pathname of stored) {
			this.images.delete(pathname);
		}
		for (const pathname of removed) {
			this.removed.delete(pathname);
		}
		return [...stored, ...removed];
	}

	// As the Blob adapter refuses them.
	private assertInFolders(pathnames: readonly string[]): void {
		if (!pathnames.every((pathname) => this.folders.contains(pathname))) {
			throw new Error("Images outside this environment's folders are never moved or deleted");
		}
	}
}
