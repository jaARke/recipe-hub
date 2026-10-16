import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { ImageStore } from '@/application/ports/image-store';
import type { RecipeService } from '@/application/recipes/recipe-service';
import { sampleRecipeContents } from '@/domain/recipe/samples/sample-recipes';
import { slugify } from '@/domain/recipe/slug';
import { getLogger } from '@/lib/logger';

// A sample's photo is stored here under the file name its pathname ends with.
const photosFolder = path.join(import.meta.dirname, 'photos');

// Every seed photo is a JPEG, as scripts/seed/photos/SOURCES.md lists.
const photoContentType = 'image/jpeg';

const logger = getLogger('seed');

// Uploads a sample's photo the store lacks, and says whether it did. Every preview's build seeds the
// one preview store, so another branch's may upload the same photo between the check and the upload;
// a failed upload whose pathname is then taken was beaten by that one, since pathnames are never
// reused.
async function uploadPhoto(images: ImageStore, pathname: string): Promise<boolean> {
	if (await images.has(pathname)) {
		return false;
	}

	const body = await readFile(path.join(photosFolder, path.basename(pathname)));
	try {
		await images.put(pathname, body, photoContentType);
	} catch (err) {
		if (await images.has(pathname)) {
			logger.info('Seed photo already uploaded', { pathname });
			return false;
		}
		throw err;
	}

	logger.info('Seed photo uploaded', { pathname });
	return true;
}

// Adds every sample recipe the database lacks, by the actor the recipe service acts as.
export async function seedSamples(recipes: RecipeService, images: ImageStore): Promise<void> {
	let recipesCreated = 0;
	let recipesSkipped = 0;
	let photosUploaded = 0;

	// The list shows the newest first, so inserting in reverse keeps the samples' order.
	for (const content of sampleRecipeContents.toReversed()) {
		// Photos go first, so a seeded recipe never points at a missing photo. An existing recipe's
		// missing photos are uploaded too, as for a seeded database given a new store.
		for (const { pathname } of content.images) {
			if (await uploadPhoto(images, pathname)) {
				photosUploaded += 1;
			}
		}

		const slug = slugify(content.title);
		if ((await recipes.getRecipe(slug)) !== null) {
			logger.info('Seed recipe skipped', { slug });
			recipesSkipped += 1;
			continue;
		}

		await recipes.createRecipe({ content });
		recipesCreated += 1;
	}

	logger.info('Seeding finished', { recipesCreated, recipesSkipped, photosUploaded });
}
