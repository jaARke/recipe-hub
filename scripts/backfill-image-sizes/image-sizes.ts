import sharp from 'sharp';
import type { ImageStore } from '@/application/ports/image-store';
import { deadlineAfter } from '@/lib/deadline';
import type { ImageSizeReader } from './backfill';

// Bounds each image's read from storage, so a read that stalls costs that image, not the run. The
// largest image, a scan of a few megabytes, downloads in seconds.
const imageReadTimeLimitMs = 30_000;

function messageOf(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

// Each image's size as a browser shows it, from the store: its width and height in pixels once its
// EXIF orientation is applied, which sharp reads from the image's header.
export function storedImageSizeReader(images: ImageStore): ImageSizeReader {
	return async (pathname) => {
		let bytes: Uint8Array;
		try {
			const image = await images.get(pathname, deadlineAfter(imageReadTimeLimitMs));
			if (image === null) {
				return { kind: 'missing' };
			}
			bytes = new Uint8Array(await new Response(image.body).arrayBuffer());
		} catch (error) {
			return { kind: 'unreadable', message: `storage read failed: ${messageOf(error)}` };
		}

		try {
			const { autoOrient } = await sharp(bytes).metadata();
			return { kind: 'sized', size: { width: autoOrient.width, height: autoOrient.height } };
		} catch (error) {
			return { kind: 'unreadable', message: `no image size: ${messageOf(error)}` };
		}
	};
}
