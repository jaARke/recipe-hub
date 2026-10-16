import 'server-only';
import type { StoredImage } from '@/application/ports/image-store';
import type { ProductionImages } from '@/application/ports/production-images';
import { requestWithin } from '@/lib/deadline';
import { imageRouteSrc } from '@/lib/image-paths';

// Longer than the 15 seconds production's route gives a Blob read, so a slow read fails there first,
// with production's own error, rather than here.
const fetchTimeLimitMs = 20_000;

type HttpProductionImagesOptions = {
	// Production's address, which every deployment knows.
	siteUrl: URL;
};

function routeFailed(problem: string): Error {
	return new Error(`Production's image route ${problem}`);
}

// Reads production's images from its public image route, as anyone may, so a preview shows the photos
// and scans its copy of production's database names without holding production's store's credentials.
export class HttpProductionImages implements ProductionImages {
	private readonly siteUrl: URL;

	constructor(options: HttpProductionImagesOptions) {
		this.siteUrl = options.siteUrl;
	}

	async get(pathname: string, signal?: AbortSignal): Promise<StoredImage | null> {
		const response = await this.request(pathname, signal);
		if (response.status === 404) {
			await response.body?.cancel();
			return null;
		}

		// Nothing is asked conditionally or in part, so anything but the whole image is a failure.
		if (response.status !== 200) {
			await response.body?.cancel();
			throw routeFailed(`answered with status ${response.status}`);
		}

		const contentType = response.headers.get('content-type');
		const etag = response.headers.get('etag');
		if (response.body === null || contentType === null || etag === null) {
			await response.body?.cancel();
			throw routeFailed('answered without a body, a Content-Type, or an ETag');
		}

		return { body: response.body, contentType, etag };
	}

	// Within the time limit and the caller's signal, aborting a request that is given up on, and refusing
	// a redirect, which production's route never answers with.
	private request(pathname: string, cancellation?: AbortSignal): Promise<Response> {
		return requestWithin(
			(signal) =>
				fetch(new URL(imageRouteSrc(pathname), this.siteUrl), { redirect: 'error', signal }),
			{ timeLimitMs: fetchTimeLimitMs, cancellation },
			() => routeFailed(`timed out after ${fetchTimeLimitMs / 1000} seconds`)
		);
	}
}
