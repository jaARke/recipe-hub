import 'server-only';
import { requireMember } from '@/application/authorization';
import type { ActorProvider } from '@/application/ports/actor-provider';
import type { ImageStore, StoredImage } from '@/application/ports/image-store';
import type { RecipeImportRepository } from '@/application/ports/recipe-import-repository';
import type { RecipeRepository } from '@/application/ports/recipe-repository';
import { InvalidImageUploadError } from '@/application/recipes/errors';
import type { ImageFolders } from '@/application/recipes/image-folders';
import { imagesInUse } from '@/application/recipes/images-in-use';
import type {
	ImageSweepCounts,
	ImageUploadGrant,
	PreviewImageCounts,
} from '@/application/recipes/recipe-dtos';
import { removedImageCutoff, unusedImageCutoff } from '@/domain/recipe/image-retention';
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

type ImageSweepStep = 'restore' | 'delete' | 'remove';

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

export class RecipeImageService {
	private readonly recipes: RecipeRepository;
	private readonly imports: RecipeImportRepository;
	private readonly images: ImageStore;
	private readonly actors: ActorProvider;
	private readonly folders: ImageFolders;

	constructor(
		recipes: RecipeRepository,
		imports: RecipeImportRepository,
		images: ImageStore,
		actors: ActorProvider,
		folders: ImageFolders
	) {
		this.recipes = recipes;
		this.imports = imports;
		this.images = images;
		this.actors = actors;
		this.folders = folders;
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

	// A system use case with no actor, run daily: brings back removed images that a recipe or draft
	// names again, as after the database is restored; deletes for good those removed long enough ago;
	// then removes uploads that nothing has named for a day. In that order, so an image both stored and
	// removed, as an interrupted removal leaves it, ends up removed.
	async sweepImages(): Promise<ImageSweepCounts> {
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

		const counts: ImageSweepCounts = {
			restoredCount: restoredPathnames.length,
			deletedCount: deletedPathnames.length,
			removedCount: removedPathnames.length,
		};
		logger.info('Images swept', {
			...counts,
			restoredPathnames,
			deletedPathnames,
			removedPathnames,
		});
		return counts;
	}

	// A system use case with no actor, for when a preview's pull request closes: deletes everything in
	// its folders for good. Refused anywhere else, since other environments' folders outlive any one
	// deployment.
	async deletePreviewImages(): Promise<PreviewImageCounts> {
		if (!this.folders.isPreview()) {
			throw new Error("Only a preview's images are ever deleted together");
		}

		const counts: PreviewImageCounts = { deletedCount: await this.images.deleteAll() };
		logger.info('Preview images deleted', counts);
		return counts;
	}

	private async isTaken(pathname: string): Promise<boolean> {
		const [stored, removed] = await Promise.all([
			this.images.has(pathname),
			this.images.hasRemoved(pathname),
		]);
		return stored || removed;
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
