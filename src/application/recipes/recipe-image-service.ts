import 'server-only';
import { requireMember } from '@/application/authorization';
import type { ActorProvider } from '@/application/ports/actor-provider';
import type { ImageStore, StoredImage } from '@/application/ports/image-store';
import {
	isPublicImagePathname,
	isRecipeImageContentType,
	isScanImagePathname,
} from '@/domain/recipe/recipe-image';
import { getLogger } from '@/lib/logger';

const logger = getLogger('images');

export class RecipeImageService {
	private readonly images: ImageStore;
	private readonly actors: ActorProvider;

	constructor(images: ImageStore, actors: ActorProvider) {
		this.images = images;
		this.actors = actors;
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
