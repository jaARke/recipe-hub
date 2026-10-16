import 'server-only';
import { AppError } from '@/lib/errors';

export type StoredImage = {
	body: ReadableStream<Uint8Array>;
	contentType: string;
	etag: string;
};

// A removed image, by the pathname it had.
export type RemovedImage = {
	pathname: string;
	removedAt: Date;
};

// An image an operation failed on, with why: the error's own words, which name no content.
export type FailedImage = {
	pathname: string;
	reason: string;
};

// What a move did besides moving: the images it left in place, and those it moved whose cached copies
// it could not purge, which may be served until they expire. Every other image moved, or was gone.
export type ImageMoveOutcome = {
	failed: FailedImage[];
	unpurged: FailedImage[];
};

// A move its signal stopped part way, caused by the signal's reason. The images it had moved were
// purged all the same, as no later sweep purges an image once it has moved, and it names those whose
// purge failed.
export class ImageMoveInterruptedError extends AppError {
	readonly code = 'image.move-interrupted';
	readonly unpurged: FailedImage[];

	constructor(unpurged: FailedImage[], options?: ErrorOptions) {
		super('Image move stopped part way', options);
		this.unpurged = unpurged;
	}
}

// Every operation but get, has, hasRemoved, and put stays inside this environment's folders. An
// operation given a signal stops once it aborts, rejecting with its reason, but for remove and restore
// once they have begun moving: those purge the images they moved, each purge within its own time
// limit, and reject with ImageMoveInterruptedError.
export interface ImageStore {
	// Returns null when no image has this pathname. The read and its body stop once the signal aborts.
	get(pathname: string, signal?: AbortSignal): Promise<StoredImage | null>;
	has(pathname: string): Promise<boolean>;
	// Never overwrites: putting a pathname that is already taken fails.
	put(pathname: string, body: Uint8Array, contentType: string): Promise<void>;
	// Moves the images aside one at a time, where each is kept until it is restored or deleted for
	// good, and purges anything cached from them. An image already gone is skipped, and one that fails
	// to move is left in place, while the rest still move.
	remove(pathnames: readonly string[], signal?: AbortSignal): Promise<ImageMoveOutcome>;
	// The pathnames of this environment's images uploaded before the given time, never removed ones.
	listUploadedBefore(cutoff: Date, signal?: AbortSignal): Promise<string[]>;
	listRemoved(signal?: AbortSignal): Promise<RemovedImage[]>;
	// Whether a removed image still holds the pathname, so it could be restored there.
	hasRemoved(pathname: string): Promise<boolean>;
	// Moves removed images back to their pathnames one at a time, as remove moves them aside, and
	// purges anything cached from them.
	restore(pathnames: readonly string[], signal?: AbortSignal): Promise<ImageMoveOutcome>;
	// Deletes removed images for good.
	deleteRemoved(pathnames: readonly string[], signal?: AbortSignal): Promise<void>;
}
