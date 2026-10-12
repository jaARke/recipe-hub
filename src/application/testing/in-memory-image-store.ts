import type { ImageStore, StoredImage } from '@/application/ports/image-store';

type InMemoryImage = {
	body: Uint8Array;
	contentType: string;
	etag: string;
};

// Records whether it was read, so tests can prove that refused pathnames never reach the store.
export class InMemoryImageStore implements ImageStore {
	private readonly images = new Map<string, InMemoryImage>();
	private read = false;

	get wasRead(): boolean {
		return this.read;
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
}
