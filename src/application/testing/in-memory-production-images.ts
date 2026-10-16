import type { StoredImage } from '@/application/ports/image-store';
import type { ProductionImages } from '@/application/ports/production-images';

type ProductionImage = {
	body: Uint8Array;
	contentType: string;
	etag: string;
};

// Production's public image route as a preview fetches from it. It serves the images a test adds and
// records each pathname it was asked for, so tests can prove which deployments never ask it.
export class InMemoryProductionImages implements ProductionImages {
	private readonly images = new Map<string, ProductionImage>();
	private readonly requested: string[] = [];

	// Every pathname it was asked for, in order.
	get requestedPathnames(): readonly string[] {
		return this.requested;
	}

	// Stands in for an image production stores and its route serves.
	add(pathname: string, body: Uint8Array, contentType: string): void {
		this.images.set(pathname, { body, contentType, etag: crypto.randomUUID() });
	}

	async get(pathname: string, signal?: AbortSignal): Promise<StoredImage | null> {
		signal?.throwIfAborted();
		this.requested.push(pathname);
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
}
