import 'server-only';
import { requireMember } from '@/application/authorization';
import type { ActorProvider } from '@/application/ports/actor-provider';
import type { ImageStore, StoredImage } from '@/application/ports/image-store';
import { InvalidImageUploadError } from '@/application/recipes/errors';
import type { ImageFolders } from '@/application/recipes/image-folders';
import type { ImageUploadGrant } from '@/application/recipes/recipe-dtos';
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

export class RecipeImageService {
	private readonly images: ImageStore;
	private readonly actors: ActorProvider;
	private readonly folders: ImageFolders;

	constructor(images: ImageStore, actors: ActorProvider, folders: ImageFolders) {
		this.images = images;
		this.actors = actors;
		this.folders = folders;
	}

	// Never asks for the actor, so responses can be cached.
	async getPublicImage(pathname: string): Promise<StoredImage | null> {
		if (!isPublicImagePathname(pathname)) {
			return null;
		}

		return this.findServedImage(pathname);
	}

	// Scans are for members, so a signed-out visitor learns nothing about which ones exist.
	async getMemberImage(pathname: string): Promise<StoredImage | null> {
		requireMember(await this.actors.currentActor());
		if (!isScanImagePathname(pathname)) {
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
		if (!this.folders.isUploadName(pathname)) {
			logger.warn('Image upload refused', { memberId: actor.memberId, pathname });
			throw new InvalidImageUploadError();
		}

		logger.info('Image upload authorized', { memberId: actor.memberId, pathname });
		return { contentType: uploadContentType, maximumSizeInBytes: maxUploadSizeInBytes };
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
