import 'server-only';
import type { ImageStore, StoredImage } from '@/application/ports/image-store';
import { isPublicImagePathname, isRecipeImageContentType } from '@/domain/recipe/recipe-image';
import { getLogger } from '@/lib/logger';

const logger = getLogger('images');

export class RecipeImageService {
	private readonly images: ImageStore;

	constructor(images: ImageStore) {
		this.images = images;
	}

	// Never asks for the actor, so responses can be cached; scans wait for member sign-in.
	async getPublicImage(pathname: string): Promise<StoredImage | null> {
		if (!isPublicImagePathname(pathname)) {
			return null;
		}

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
