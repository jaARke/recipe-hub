import type { ImageStore, StoredImage } from '@/application/ports/image-store';

type InMemoryImage = {
	body: Uint8Array;
	contentType: string;
	etag: string;
};

// Records whether it was read, so tests can prove that refused pathnames never reach the store, and
// what it deleted. A test can make deleting fail, as an unreachable store would.
export class InMemoryImageStore implements ImageStore {
	private readonly images = new Map<string, InMemoryImage>();
	private readonly deleted: string[] = [];
	private read = false;
	private deletesFail = false;

	get wasRead(): boolean {
		return this.read;
	}

	get deletedPathnames(): readonly string[] {
		return this.deleted;
	}

	failDeletes(): void {
		this.deletesFail = true;
	}

	async get(pathname: string): Promise<StoredImage | null> {
		this.read = true;
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

		this.images.set(pathname, { body, contentType, etag: crypto.randomUUID() });
	}

	async delete(pathnames: readonly string[]): Promise<void> {
		if (this.deletesFail) {
			throw new Error('The image store could not be reached');
		}

		for (const pathname of pathnames) {
			this.images.delete(pathname);
			this.deleted.push(pathname);
		}
	}
}
