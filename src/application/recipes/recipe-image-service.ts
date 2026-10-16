import 'server-only';
import { requireMember } from '@/application/authorization';
import type { ActorProvider } from '@/application/ports/actor-provider';
import type { ImageMoveLock, LockAttempt } from '@/application/ports/image-move-lock';
import {
	ImageMoveInterruptedError,
	type FailedImage,
	type ImageMoveOutcome,
	type ImageStore,
	type StoredImage,
} from '@/application/ports/image-store';
import type { ProductionImages } from '@/application/ports/production-images';
import type { RecipeImportRepository } from '@/application/ports/recipe-import-repository';
import type { RecipeRepository } from '@/application/ports/recipe-repository';
import type { SavedDraftRepository } from '@/application/ports/saved-draft-repository';
import type { TaskScheduler } from '@/application/ports/task-scheduler';
import { InvalidImageUploadError } from '@/application/recipes/errors';
import type { ImageFolders } from '@/application/recipes/image-folders';
import { imagesInUse } from '@/application/recipes/images-in-use';
import type {
	ImageSweepCounts,
	ImageUploadGrant,
	ReleasedImages,
} from '@/application/recipes/recipe-dtos';
import { removedImageCutoff, unusedImageCutoff } from '@/domain/recipe/image-retention';
import type { RecipeId } from '@/domain/recipe/recipe';
import { isRecipeImageContentType, type RecipeImageRole } from '@/domain/recipe/recipe-image';
import { deadlineAfter, settleWithin } from '@/lib/deadline';
import { getLogger } from '@/lib/logger';

// The browser re-encodes every photo as a JPEG before uploading it.
const uploadContentType = 'image/jpeg';

// Re-encoded photos are 0.4 to 2.2 MB, and the CDN caches streamed responses only up to 20 MB.
const maxUploadSizeInBytes = 8 * 1024 * 1024;

// Bounds an image move from when it holds the lock: a sweep, or a write's removal and the sweep after
// it. The cleanup cron keeps time to log and answer within its maxDuration of 120 seconds, a write's
// background task stays within its function's time, and the lock's transaction, idle meanwhile, ends
// long before Neon ends one idle for 5 minutes.
const imageMoveTimeLimitMs = 60 * 1000;

const logger = getLogger('images');

type ImageSweepStep = 'restore' | 'delete' | 'remove';

// An image a sweep step failed on, with why.
type FailedSweepImage = FailedImage & { step: ImageSweepStep };

// What a sweep step did: the images it handled, those it left where they were, and those it moved
// whose cached copies it could not purge.
type SweepStepOutcome = {
	pathnames: string[];
	failedImages: FailedSweepImage[];
	unpurgedImages: FailedSweepImage[];
};

const noFailures: ImageMoveOutcome = { failed: [], unpurged: [] };

function imageMoveTimedOut(cause?: unknown): Error {
	return new Error(`The image move timed out after ${imageMoveTimeLimitMs / 1000} seconds`, {
		cause,
	});
}

// Runs one step of an image move within its deadline, and none once the deadline has passed.
async function withinImageMove<T>(deadline: AbortSignal, step: () => Promise<T>): Promise<T> {
	if (deadline.aborted) {
		throw imageMoveTimedOut();
	}

	return settleWithin(step(), { deadline }, imageMoveTimedOut);
}

// Runs a store's move, which takes the deadline as its signal and stops at it on its own, purging what
// it moved first, so it is waited for rather than left behind at the deadline. None starts once the
// deadline has passed, and one the deadline stopped ends with the time-out, caused by its own error.
async function moveWithin<T>(
	deadline: AbortSignal,
	move: (signal: AbortSignal) => Promise<T>
): Promise<T> {
	if (deadline.aborted) {
		throw imageMoveTimedOut();
	}

	try {
		return await move(deadline);
	} catch (err) {
		throw deadline.aborted ? imageMoveTimedOut(err) : err;
	}
}

// The images a move the deadline stopped had moved but could not purge. No later sweep purges an
// image once it has moved, so each failure line names them, as a finished move's line does.
function unpurgedBeforeTimeOut(err: unknown): FailedImage[] {
	return err instanceof Error && err.cause instanceof ImageMoveInterruptedError
		? err.cause.unpurged
		: [];
}

// The images a move handled: all it was given but those it left in place.
function movedPathnames(pathnames: string[], failed: FailedImage[]): string[] {
	const failedPathnames = new Set(failed.map(({ pathname }) => pathname));
	return pathnames.filter((pathname) => !failedPathnames.has(pathname));
}

// The items in a fresh random order, each placed by a random key of its own.
function shuffled<T>(items: readonly T[]): T[] {
	return items
		.map((item) => ({ item, key: Math.random() }))
		.sort((first, second) => first.key - second.key)
		.map(({ item }) => item);
}

// A step that fails is logged and left for the next sweep, which finds the same images again; the
// deadline passing then ends the sweep.
function sweepStepFailed(
	step: ImageSweepStep,
	pathnames: string[],
	err: unknown,
	deadline: AbortSignal
): void {
	const unpurged = unpurgedBeforeTimeOut(err);
	logger.warn('Image sweep step failed', {
		step,
		pathnames,
		...(unpurged.length > 0 && { unpurgedImages: unpurged.map((image) => ({ step, ...image })) }),
		err,
	});
	if (deadline.aborted) {
		throw err;
	}
}

// An image that fails alone is recorded with why, and the rest carry on. Each sweep hands the store
// the step's images in a fresh order, so images whose moves stall hold no fixed place ahead of the
// rest, which a later sweep reaches when this one's deadline does not.
async function sweepStep(
	step: ImageSweepStep,
	pathnames: string[],
	run: (pathnames: string[], signal: AbortSignal) => Promise<ImageMoveOutcome>,
	deadline: AbortSignal
): Promise<SweepStepOutcome> {
	if (pathnames.length === 0) {
		return { pathnames: [], failedImages: [], unpurgedImages: [] };
	}

	try {
		const { failed, unpurged } = await moveWithin(deadline, (signal) =>
			run(shuffled(pathnames), signal)
		);
		return {
			pathnames: movedPathnames(pathnames, failed),
			failedImages: failed.map((image) => ({ step, ...image })),
			unpurgedImages: unpurged.map((image) => ({ step, ...image })),
		};
	} catch (err) {
		sweepStepFailed(step, pathnames, err, deadline);
		return { pathnames: [], failedImages: [], unpurgedImages: [] };
	}
}

// Left where they are, for a later sweep to remove once nothing has named them for a day.
function warnImagesNotRemoved(recipeId: RecipeId, pathnames: string[], err: unknown): void {
	const unpurged = unpurgedBeforeTimeOut(err);
	logger.warn('Recipe images could not be removed', {
		recipeId,
		pathnames,
		...(unpurged.length > 0 && { unpurgedImages: unpurged }),
		err,
	});
}

export class RecipeImageService {
	private readonly recipes: RecipeRepository;
	private readonly imports: RecipeImportRepository;
	private readonly drafts: SavedDraftRepository;
	private readonly images: ImageStore;
	private readonly productionImages: ProductionImages;
	private readonly actors: ActorProvider;
	private readonly folders: ImageFolders;
	private readonly moveLock: ImageMoveLock;
	private readonly scheduleTask: TaskScheduler;
	private readonly sweepsAfterWrites: boolean;

	// Where nothing sweeps on a schedule, as on previews and the dev server, each write's background
	// task sweeps once it is done.
	constructor(
		recipes: RecipeRepository,
		imports: RecipeImportRepository,
		drafts: SavedDraftRepository,
		images: ImageStore,
		productionImages: ProductionImages,
		actors: ActorProvider,
		folders: ImageFolders,
		moveLock: ImageMoveLock,
		scheduleTask: TaskScheduler,
		sweepsAfterWrites: boolean
	) {
		this.recipes = recipes;
		this.imports = imports;
		this.drafts = drafts;
		this.images = images;
		this.productionImages = productionImages;
		this.actors = actors;
		this.folders = folders;
		this.moveLock = moveLock;
		this.scheduleTask = scheduleTask;
		this.sweepsAfterWrites = sweepsAfterWrites;
	}

	// A dish photo or a scan, which anyone may see, from a folder this environment reads in its store
	// or fetches from production, as a preview does production's. Never asks for the actor, so
	// responses can be cached. The read and its body stop once the signal aborts.
	async getPublicImage(pathname: string, signal?: AbortSignal): Promise<StoredImage | null> {
		if (this.folders.isFetchedFromProduction(pathname)) {
			return this.servedImage(pathname, await this.productionImages.get(pathname, signal));
		}

		if (!this.folders.isReadable(pathname)) {
			return null;
		}

		return this.servedImage(pathname, await this.images.get(pathname, signal));
	}

	// The browser names each upload <folder><uuid>.jpg.
	uploadFolders(): Record<RecipeImageRole, string> {
		return { dish: this.folders.uploadFolder('dish'), scan: this.folders.uploadFolder('scan') };
	}

	// A member may upload one new photo to a fresh name in this environment's folders, never over
	// another environment's photos.
	async authorizeUpload(pathname: string): Promise<ImageUploadGrant> {
		const actor = requireMember(await this.actors.currentActor());
		// Only a pathname nothing holds, stored or removed: a grant outlives the minutes it takes to
		// remove an image, and a removed image keeps its pathname while it can be restored.
		if (!this.folders.isUploadName(pathname) || (await this.isTaken(pathname))) {
			logger.warn('Image upload refused', { memberId: actor.memberId, pathname });
			throw new InvalidImageUploadError();
		}

		logger.info('Image upload authorized', { memberId: actor.memberId, pathname });
		return { contentType: uploadContentType, maximumSizeInBytes: maxUploadSizeInBytes };
	}

	// Runs once the response is sent, so the write that calls it never waits. Every recipe, import, and
	// saved draft write calls it. An edit or delete passes the images it let go, which the task
	// removes everywhere; where the environment sweeps after writes, the task then sweeps.
	scheduleSweep(released?: ReleasedImages): void {
		if (released === undefined && !this.sweepsAfterWrites) {
			return;
		}

		this.scheduleTask(async () => {
			try {
				await (released === undefined ? this.sweepImages() : this.removeAndSweep(released));
			} catch (err) {
				logger.error('Image sweep failed', { err });
			}
		});
	}

	// A system use case with no actor. Skipped while another image move runs: a running sweep covers
	// it, as does a write's removal that sweeps in the same hold, and the next sweep finds the rest.
	async sweepImages(): Promise<LockAttempt<ImageSweepCounts>> {
		const attempt = await this.moveLock.tryRun(() =>
			this.sweep(deadlineAfter(imageMoveTimeLimitMs))
		);
		if (attempt.status === 'skipped') {
			logger.info('Image sweep skipped while another image move runs');
		}
		return attempt;
	}

	private async isTaken(pathname: string): Promise<boolean> {
		const [stored, removed] = await Promise.all([
			this.images.has(pathname),
			this.images.hasRemoved(pathname),
		]);
		return stored || removed;
	}

	// Waits for the lock rather than skipping, so the images go now rather than at a later sweep, and
	// sweeps in the same hold where the environment sweeps after writes. Other environments' images,
	// such as production's on a preview's copy, are kept. A wait that times out leaves the images for a
	// later sweep.
	private async removeAndSweep({ recipeId, images }: ReleasedImages): Promise<void> {
		const pathnames = images
			.map(({ pathname }) => pathname)
			.filter((pathname) => this.folders.contains(pathname));
		if (pathnames.length === 0) {
			if (this.sweepsAfterWrites) {
				await this.sweepImages();
			}
			return;
		}

		// Set once the lock is held, so a wait that times out is told apart from a sweep that fails.
		let held = false;
		try {
			await this.moveLock.run(async () => {
				held = true;
				const deadline = deadlineAfter(imageMoveTimeLimitMs);
				await this.removeReleasedImages(recipeId, pathnames, deadline);
				if (this.sweepsAfterWrites) {
					await this.sweep(deadline);
				}
			});
		} catch (err) {
			if (held) {
				throw err;
			}
			warnImagesNotRemoved(recipeId, pathnames, err);
		}
	}

	// After the write commits, so a failure leaves an unused image rather than a recipe naming a missing
	// one; a failure is logged, and the sweep carries on. An image that fails to move alone, or whose
	// caches were not purged once it moved, is named with why, and the rest are removed. An image
	// another recipe still lists or an unexpired import or saved draft names is kept, as importing the
	// same scans twice makes drafts share them.
	private async removeReleasedImages(
		recipeId: RecipeId,
		pathnames: string[],
		deadline: AbortSignal
	): Promise<void> {
		try {
			const inUse = await withinImageMove(deadline, () =>
				imagesInUse(pathnames, this.recipes, this.imports, this.drafts, new Date())
			);
			const unusedPathnames = pathnames.filter((pathname) => !inUse.has(pathname));
			const keptPathnames = pathnames.filter((pathname) => inUse.has(pathname));
			const { failed, unpurged } =
				unusedPathnames.length > 0
					? await moveWithin(deadline, (signal) => this.images.remove(unusedPathnames, signal))
					: noFailures;

			logger.info('Recipe images removed', {
				recipeId,
				pathnames: movedPathnames(unusedPathnames, failed),
				...(keptPathnames.length > 0 && { keptPathnames }),
				...(failed.length > 0 && { failedImages: failed }),
				...(unpurged.length > 0 && { unpurgedImages: unpurged }),
			});
		} catch (err) {
			warnImagesNotRemoved(recipeId, pathnames, err);
		}
	}

	// Brings back removed images that a recipe or draft names again, as after the database is restored
	// or a save attaches an image an earlier sweep was removing; deletes for good those removed long
	// enough ago; then removes uploads that nothing has named for a day. In that order, so an image
	// both stored and removed, as an interrupted removal leaves it, ends up removed. Each step runs
	// within the image move's deadline, which also stops every store call but a move's purge of what it
	// moved, and the deadline passing ends the sweep.
	private async sweep(deadline: AbortSignal): Promise<ImageSweepCounts> {
		const now = new Date();
		const [removed, uploaded] = await withinImageMove(deadline, () =>
			Promise.all([
				this.images.listRemoved(deadline),
				this.images.listUploadedBefore(unusedImageCutoff(now), deadline),
			])
		);
		const inUse = await withinImageMove(deadline, () =>
			imagesInUse(
				[...removed.map(({ pathname }) => pathname), ...uploaded],
				this.recipes,
				this.imports,
				this.drafts,
				now
			)
		);
		const expiredBefore = removedImageCutoff(now);

		const restored = await sweepStep(
			'restore',
			removed.filter(({ pathname }) => inUse.has(pathname)).map(({ pathname }) => pathname),
			(pathnames, signal) => this.images.restore(pathnames, signal),
			deadline
		);
		// Deletes fail together, never one image alone.
		const deleted = await sweepStep(
			'delete',
			removed
				.filter(({ pathname, removedAt }) => !inUse.has(pathname) && removedAt < expiredBefore)
				.map(({ pathname }) => pathname),
			async (pathnames, signal) => {
				await this.images.deleteRemoved(pathnames, signal);
				return noFailures;
			},
			deadline
		);
		const removedUploads = await sweepStep(
			'remove',
			uploaded.filter((pathname) => !inUse.has(pathname)),
			(pathnames, signal) => this.images.remove(pathnames, signal),
			deadline
		);

		const steps = [restored, deleted, removedUploads];
		const failedImages = steps.flatMap((outcome) => outcome.failedImages);
		const counts: ImageSweepCounts = {
			restoredCount: restored.pathnames.length,
			deletedCount: deleted.pathnames.length,
			removedCount: removedUploads.pathnames.length,
			failedCount: failedImages.length,
		};
		logger.info('Images swept', {
			...counts,
			restoredPathnames: restored.pathnames,
			deletedPathnames: deleted.pathnames,
			removedPathnames: removedUploads.pathnames,
			failedImages,
			unpurgedImages: steps.flatMap((outcome) => outcome.unpurgedImages),
		});
		return counts;
	}

	// Only image types every browser displays are served.
	private async servedImage(
		pathname: string,
		image: StoredImage | null
	): Promise<StoredImage | null> {
		if (image === null || isRecipeImageContentType(image.contentType)) {
			return image;
		}

		logger.warn('Stored image has an unsupported content type', {
			pathname,
			contentType: image.contentType,
		});
		await image.body.cancel();
		return null;
	}
}
