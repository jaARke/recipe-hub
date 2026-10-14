import 'server-only';
import { requireMember } from '@/application/authorization';
import type { ActorProvider } from '@/application/ports/actor-provider';
import type { ImageMoveLock, LockAttempt } from '@/application/ports/image-move-lock';
import type { ImageStore, StoredImage } from '@/application/ports/image-store';
import type { RecipeImportRepository } from '@/application/ports/recipe-import-repository';
import type { RecipeRepository } from '@/application/ports/recipe-repository';
import type { TaskScheduler } from '@/application/ports/task-scheduler';
import { InvalidImageUploadError } from '@/application/recipes/errors';
import type { ImageFolders } from '@/application/recipes/image-folders';
import { imagesInUse } from '@/application/recipes/images-in-use';
import type {
	ImageSweepCounts,
	ImageUploadGrant,
	ReleasedImages,
} from '@/application/recipes/recipe-dtos';
import {
	expiringImageCutoff,
	removedImageCutoff,
	unusedImageCutoff,
} from '@/domain/recipe/image-retention';
import type { RecipeId } from '@/domain/recipe/recipe';
import {
	isPublicImagePathname,
	isRecipeImageContentType,
	isScanImagePathname,
	type RecipeImageRole,
} from '@/domain/recipe/recipe-image';
import { getLogger } from '@/lib/logger';

// The browser re-encodes every photo as a JPEG before uploading it.
const uploadContentType = 'image/jpeg';

// Re-encoded photos are 0.4 to 2.2 MB, and the CDN caches streamed responses only up to 20 MB.
const maxUploadSizeInBytes = 8 * 1024 * 1024;

const logger = getLogger('images');

type ImageSweepStep = 'restore' | 'delete' | 'remove' | 'expire';

// A step that fails is logged and left for the next sweep, which finds the same images again.
async function sweepStep(
	step: ImageSweepStep,
	pathnames: string[],
	run: (pathnames: string[]) => Promise<void>
): Promise<string[]> {
	if (pathnames.length === 0) {
		return [];
	}

	try {
		await run(pathnames);
		return pathnames;
	} catch (err) {
		logger.warn('Image sweep step failed', { step, pathnames, err });
		return [];
	}
}

// The store finds expired images as it deletes them, so a failure is logged without pathnames, and
// the next sweep finds whatever is left.
async function expireStep(run: () => Promise<string[]>): Promise<string[]> {
	try {
		return await run();
	} catch (err) {
		logger.warn('Image sweep step failed', { step: 'expire' satisfies ImageSweepStep, err });
		return [];
	}
}

// Left where they are, for a later sweep to remove once nothing has named them for a day.
function warnImagesNotRemoved(recipeId: RecipeId, pathnames: string[], err: unknown): void {
	logger.warn('Recipe images could not be removed', { recipeId, pathnames, err });
}

export class RecipeImageService {
	private readonly recipes: RecipeRepository;
	private readonly imports: RecipeImportRepository;
	private readonly images: ImageStore;
	private readonly actors: ActorProvider;
	private readonly folders: ImageFolders;
	private readonly moveLock: ImageMoveLock;
	private readonly scheduleTask: TaskScheduler;

	constructor(
		recipes: RecipeRepository,
		imports: RecipeImportRepository,
		images: ImageStore,
		actors: ActorProvider,
		folders: ImageFolders,
		moveLock: ImageMoveLock,
		scheduleTask: TaskScheduler
	) {
		this.recipes = recipes;
		this.imports = imports;
		this.images = images;
		this.actors = actors;
		this.folders = folders;
		this.moveLock = moveLock;
		this.scheduleTask = scheduleTask;
	}

	// Never asks for the actor, so responses can be cached.
	async getPublicImage(pathname: string): Promise<StoredImage | null> {
		if (!isPublicImagePathname(pathname) || !this.folders.isReadable(pathname)) {
			return null;
		}

		return this.findServedImage(pathname);
	}

	// Scans are for members, so a signed-out visitor learns nothing about which ones exist.
	async getMemberImage(pathname: string): Promise<StoredImage | null> {
		requireMember(await this.actors.currentActor());
		if (!isScanImagePathname(pathname) || !this.folders.isReadable(pathname)) {
			return null;
		}

		return this.findServedImage(pathname);
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

	// Sweeps once the response is sent, so the write that calls it never waits. Every recipe and import
	// write calls it, so cleanup follows activity rather than a schedule. An edit or delete passes the
	// images it let go, which the task removes before it sweeps.
	scheduleSweep(released?: ReleasedImages): void {
		this.scheduleTask(async () => {
			try {
				await (released === undefined ? this.sweepImages() : this.removeAndSweep(released));
			} catch (err) {
				logger.error('Image sweep failed', { err });
			}
		});
	}

	// A system use case with no actor. Skipped while another image move runs: a running sweep covers
	// it, as does a write's removal, which sweeps in the same hold once its images are removed.
	async sweepImages(): Promise<LockAttempt<ImageSweepCounts>> {
		const attempt = await this.moveLock.tryRun(() => this.sweep());
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

	// Waits for the lock rather than skipping, so the images go now rather than at a later write's
	// sweep, and sweeps in the same hold. Other environments' images, such as production's on a
	// preview's copy, are kept. A wait that times out leaves the images for a later sweep.
	private async removeAndSweep({ recipeId, images }: ReleasedImages): Promise<void> {
		const pathnames = images
			.map(({ pathname }) => pathname)
			.filter((pathname) => this.folders.contains(pathname));
		if (pathnames.length === 0) {
			await this.sweepImages();
			return;
		}

		// Set once the lock is held, so a wait that times out is told apart from a sweep that fails.
		let held = false;
		try {
			await this.moveLock.run(async () => {
				held = true;
				await this.removeReleasedImages(recipeId, pathnames);
				await this.sweep();
			});
		} catch (err) {
			if (held) {
				throw err;
			}
			warnImagesNotRemoved(recipeId, pathnames, err);
		}
	}

	// After the write commits, so a failure leaves an unused image rather than a recipe naming a missing
	// one; a failure is logged, and the sweep carries on. An image another recipe still lists or an
	// unexpired draft names is kept, as importing the same scans twice makes drafts share them.
	private async removeReleasedImages(recipeId: RecipeId, pathnames: string[]): Promise<void> {
		try {
			const inUse = await imagesInUse(pathnames, this.recipes, this.imports, new Date());
			const removedPathnames = pathnames.filter((pathname) => !inUse.has(pathname));
			const keptPathnames = pathnames.filter((pathname) => inUse.has(pathname));
			if (removedPathnames.length > 0) {
				await this.images.remove(removedPathnames);
			}

			logger.info('Recipe images removed', {
				recipeId,
				pathnames: removedPathnames,
				...(keptPathnames.length > 0 && { keptPathnames }),
			});
		} catch (err) {
			warnImagesNotRemoved(recipeId, pathnames, err);
		}
	}

	// Brings back removed images that a recipe or draft names again, as after the database is restored
	// or a save attaches an image an earlier sweep was removing; deletes for good those removed long
	// enough ago; removes uploads that nothing has named for a day; then deletes old images in the
	// expiring environments' folders. In that order, so an image both stored and removed, as an
	// interrupted removal leaves it, ends up removed.
	private async sweep(): Promise<ImageSweepCounts> {
		const now = new Date();
		const [removed, uploaded] = await Promise.all([
			this.images.listRemoved(),
			this.images.listUploadedBefore(unusedImageCutoff(now)),
		]);
		const inUse = await imagesInUse(
			[...removed.map(({ pathname }) => pathname), ...uploaded],
			this.recipes,
			this.imports,
			now
		);
		const expiredBefore = removedImageCutoff(now);

		const restoredPathnames = await sweepStep(
			'restore',
			removed.filter(({ pathname }) => inUse.has(pathname)).map(({ pathname }) => pathname),
			(pathnames) => this.images.restore(pathnames)
		);
		const deletedPathnames = await sweepStep(
			'delete',
			removed
				.filter(({ pathname, removedAt }) => !inUse.has(pathname) && removedAt < expiredBefore)
				.map(({ pathname }) => pathname),
			(pathnames) => this.images.deleteRemoved(pathnames)
		);
		const removedPathnames = await sweepStep(
			'remove',
			uploaded.filter((pathname) => !inUse.has(pathname)),
			(pathnames) => this.images.remove(pathnames)
		);
		const expiredPathnames = await expireStep(() =>
			this.images.deleteExpired(expiringImageCutoff(now))
		);

		const counts: ImageSweepCounts = {
			restoredCount: restoredPathnames.length,
			deletedCount: deletedPathnames.length,
			removedCount: removedPathnames.length,
			expiredCount: expiredPathnames.length,
		};
		logger.info('Images swept', {
			...counts,
			restoredPathnames,
			deletedPathnames,
			removedPathnames,
			expiredPathnames,
		});
		return counts;
	}

	// Only image types every browser displays are served.
	private async findServedImage(pathname: string): Promise<StoredImage | null> {
		const image = await this.images.get(pathname);
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
