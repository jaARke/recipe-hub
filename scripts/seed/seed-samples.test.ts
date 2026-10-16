import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { ImageFolders } from '@/application/recipes/image-folders';
import { RecipeService } from '@/application/recipes/recipe-service';
import { actorFor } from '@/application/testing/actors';
import { FixedActorProvider } from '@/application/testing/fixed-actor-provider';
import { InMemoryFavoriteRepository } from '@/application/testing/in-memory-favorite-repository';
import { InMemoryImageStore } from '@/application/testing/in-memory-image-store';
import { InMemoryInviteRepository } from '@/application/testing/in-memory-invite-repository';
import { InMemoryMemberRepository } from '@/application/testing/in-memory-member-repository';
import { InMemoryRecipeImportRepository } from '@/application/testing/in-memory-recipe-import-repository';
import { InMemoryRecipeRepository } from '@/application/testing/in-memory-recipe-repository';
import { InMemorySavedDraftRepository } from '@/application/testing/in-memory-saved-draft-repository';
import { seedSamples } from './seed-samples';

// The samples with photos, by the pathnames scripts/seed/photos holds them under.
const photoPathnames = [
	'dish/seed/buttermilk-biscuits.jpg',
	'dish/seed/weeknight-chicken-soup.jpg',
	'dish/seed/sunday-pot-roast.jpg',
	'dish/seed/garden-tomato-salad.jpg',
];
// Every sample recipe, four of them with a photo.
const sampleCount = 30;

let consoleInfo: MockInstance<typeof console.info>;

beforeEach(() => {
	// Keeps log lines out of the test output; the tests that check logging read them here.
	consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => {});
});

afterEach(() => {
	vi.restoreAllMocks();
});

function logLines(): unknown[] {
	return consoleInfo.mock.calls.map(([line]) => JSON.parse(String(line)));
}

// An empty database and seed folder, and the recipe service as the seed builds it, acting as the
// sample contributor.
async function createSeed() {
	const recipes = new InMemoryRecipeRepository();
	const drafts = new InMemorySavedDraftRepository();
	const members = new InMemoryMemberRepository(
		new InMemoryInviteRepository(),
		new InMemoryFavoriteRepository(recipes),
		drafts
	);
	const contributor = await members.create({
		email: 'sample-contributor@recipes.invalid',
		displayName: 'Sample contributor',
		role: 'member',
	});
	const folders = new ImageFolders('seed');
	const images = new InMemoryImageStore(folders);
	const service = new RecipeService(
		recipes,
		new InMemoryRecipeImportRepository(recipes),
		drafts,
		members,
		images,
		new FixedActorProvider(actorFor(contributor)),
		folders
	);
	return { recipes, images, service };
}

describe('seedSamples', () => {
	it("uploads every sample's photo, then creates every sample", async () => {
		const { recipes, images, service } = await createSeed();

		await seedSamples(service, images);

		for (const pathname of photoPathnames) {
			expect(await images.has(pathname)).toBe(true);
		}
		expect(await recipes.listIds()).toHaveLength(sampleCount);
		expect(logLines()).toContainEqual({
			level: 'info',
			logger: 'seed',
			message: 'Seeding finished',
			recipesCreated: sampleCount,
			recipesSkipped: 0,
			photosUploaded: 4,
		});
	});

	it("finishes when another preview's build uploads a photo between its check and its upload", async () => {
		const { recipes, images, service } = await createSeed();
		const racing = 'dish/seed/sunday-pot-roast.jpg';
		const put = images.put.bind(images);
		vi.spyOn(images, 'put').mockImplementation(async (pathname, body, contentType) => {
			if (pathname === racing) {
				// The other build's upload lands first, so this one finds the pathname taken.
				await put(pathname, body, contentType);
			}
			return put(pathname, body, contentType);
		});

		await seedSamples(service, images);

		expect(await images.has(racing)).toBe(true);
		expect(await recipes.listIds()).toHaveLength(sampleCount);
		expect(logLines()).toContainEqual({
			level: 'info',
			logger: 'seed',
			message: 'Seed photo already uploaded',
			pathname: racing,
		});
		expect(logLines()).toContainEqual(
			expect.objectContaining({ message: 'Seeding finished', photosUploaded: 3 })
		);
	});

	it('rethrows an upload that failed with the photo still missing, creating no recipe without it', async () => {
		const { recipes, images, service } = await createSeed();
		const failing = 'dish/seed/garden-tomato-salad.jpg';
		const put = images.put.bind(images);
		vi.spyOn(images, 'put').mockImplementation(async (pathname, body, contentType) => {
			if (pathname === failing) {
				throw new Error('Blob is unreachable');
			}
			return put(pathname, body, contentType);
		});

		await expect(seedSamples(service, images)).rejects.toThrow('Blob is unreachable');
		expect(await images.has(failing)).toBe(false);
		const titles = await Promise.all(
			(await recipes.listIds()).map(async (id) => (await recipes.findById(id))?.title)
		);
		expect(titles).not.toContain('Garden tomato salad');
	});
});
