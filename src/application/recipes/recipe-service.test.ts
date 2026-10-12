import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { ForbiddenError, SignInRequiredError } from '@/application/authorization';
import type { Actor } from '@/application/ports/actor-provider';
import type { RecipePage } from '@/application/ports/recipe-repository';
import {
	InvalidRecipePageError,
	RecipeEditConflictError,
	RecipeNotFoundError,
} from '@/application/recipes/errors';
import { ImageFolders } from '@/application/recipes/image-folders';
import { RecipeService, type CreateRecipeInput } from '@/application/recipes/recipe-service';
import { actorFor, adminActor, anonymousActor, memberActor } from '@/application/testing/actors';
import { FixedActorProvider } from '@/application/testing/fixed-actor-provider';
import { InMemoryImageStore } from '@/application/testing/in-memory-image-store';
import { InMemoryMemberRepository } from '@/application/testing/in-memory-member-repository';
import { InMemoryRecipeRepository } from '@/application/testing/in-memory-recipe-repository';
import {
	recipeContentSchema,
	type RecipeContentInput,
	type RecipeId,
} from '@/domain/recipe/recipe';
import type { RecipeImage } from '@/domain/recipe/recipe-image';
import {
	sampleButtermilkBiscuits,
	sampleChickenSoup,
	sampleLemonIceboxPie,
	sampleRecipeContents,
	sampleTomatoSalad,
} from '@/domain/recipe/samples/sample-recipes';
import { slugify } from '@/domain/recipe/slug';

const missingId = '0199c7a4-2c3e-7b1a-9f00-2a7c1e4b5d6e';
const malformedId = 'not-a-recipe-id';
// For saves refused before their version is compared.
const anyVersion = '2026-10-12T00:00:00.000Z';

// The samples' photos are the seed's, so the catalog writes images where the seed does.
const folders = new ImageFolders('seed');

const dishPhoto: RecipeImage = {
	role: 'dish',
	pathname: 'dish/seed/soup.jpg',
	alt: 'A bowl of soup',
};
const secondDishPhoto: RecipeImage = { role: 'dish', pathname: 'dish/seed/soup-pot.jpg' };
const scan: RecipeImage = { role: 'scan', pathname: 'scan/seed/soup-card.jpg' };
// Stored by another environment, as production's photos are for a preview's copied recipes.
const productionPhoto: RecipeImage = { role: 'dish', pathname: 'dish/production/soup.jpg' };
// In this environment's folder, but its upload never finished.
const unfinishedPhoto: RecipeImage = { role: 'dish', pathname: 'dish/seed/half-sent.jpg' };

const unfinishedPhotoMessage = "This photo didn't finish uploading. Remove it and add it again.";

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

function manualEntry(content: RecipeContentInput): CreateRecipeInput {
	return { content, provenance: { entryMode: 'manual' } };
}

// One catalog, with a service per actor. Every photo but the unfinished one is stored.
async function createCatalog() {
	const recipes = new InMemoryRecipeRepository();
	const members = new InMemoryMemberRepository();
	const images = new InMemoryImageStore();
	const storedImages = [
		...sampleRecipeContents.flatMap((content) => content.images),
		dishPhoto,
		secondDishPhoto,
		scan,
		productionPhoto,
	];
	for (const pathname of new Set(storedImages.map((image) => image.pathname))) {
		await images.put(pathname, jpeg, 'image/jpeg');
	}

	const serviceFor = (actor: Actor) =>
		new RecipeService(recipes, members, images, new FixedActorProvider(actor), folders);
	// The version an editor that loaded the recipe just now sends back with its save.
	const versionOf = async (id: RecipeId) => {
		const recipe = await recipes.findById(id);
		if (recipe === null) {
			throw new Error('No recipe has this id');
		}
		return recipe.updatedAt.toISOString();
	};
	// Signed in with an account, so recipe pages can name the member.
	const addMember = async (displayName: string) =>
		actorFor(
			await members.create({
				email: `${displayName.toLowerCase()}@example.com`,
				displayName,
				role: 'member',
			})
		);
	return { recipes, members, images, serviceFor, addMember, versionOf };
}

async function catalogWithBiscuits() {
	const catalog = await createCatalog();
	const author = await catalog.addMember('Ada');
	const ref = await catalog.serviceFor(author).createRecipe(manualEntry(sampleButtermilkBiscuits));
	return { ...catalog, author, ref };
}

// A recipe as a preview's copied rows hold it, with images the service never checked.
async function catalogWithStoredImages(images: RecipeImage[]) {
	const catalog = await createCatalog();
	const author = await catalog.addMember('Ada');
	const content = recipeContentSchema.parse({ ...sampleChickenSoup, images });
	const recipe = await catalog.recipes.create({
		content,
		provenance: { entryMode: 'manual' },
		contributorId: author.memberId,
		slugBase: slugify(content.title),
	});
	return { ...catalog, author, recipe };
}

// Two recipes listing one photo: a crafted save can name a photo another recipe already uses.
async function catalogWithSharedPhoto() {
	const catalog = await createCatalog();
	const author = await catalog.addMember('Ada');
	const service = catalog.serviceFor(author);
	const soup = await service.createRecipe(
		manualEntry({ ...sampleChickenSoup, images: [dishPhoto, secondDishPhoto] })
	);
	const salad = await service.createRecipe(
		manualEntry({ ...sampleTomatoSalad, images: [dishPhoto] })
	);
	return { ...catalog, service, soup, salad };
}

function logLines(spy: MockInstance<(...args: unknown[]) => void>): unknown[] {
	return spy.mock.calls.map(([line]) => JSON.parse(String(line)));
}

let consoleInfo: MockInstance<typeof console.info>;
let consoleWarn: MockInstance<typeof console.warn>;

beforeEach(() => {
	// Keeps log lines out of the test output; the logging tests read them here.
	consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => {});
	consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('public reads', () => {
	it('never ask who is calling, so pages can cache them', async () => {
		const { recipes, members, images, serviceFor, addMember } = await createCatalog();
		const ref = await serviceFor(await addMember('Ada')).createRecipe(
			manualEntry(sampleTomatoSalad)
		);
		const actors = new FixedActorProvider(memberActor());
		const reader = new RecipeService(recipes, members, images, actors, folders);

		await reader.getRecipe(ref.slug);
		await reader.listRecipes({ limit: 10, offset: 0, sort: 'newest' });

		expect(actors.wasAsked).toBe(false);
	});
});

describe('getRecipe', () => {
	it("shows dish photos, the source URL, and the contributor's name, but no scans or entry details", async () => {
		const { serviceFor, addMember } = await createCatalog();
		const author = await addMember('Ada');
		const ref = await serviceFor(author).createRecipe({
			content: { ...sampleChickenSoup, images: [scan, dishPhoto] },
			provenance: {
				entryMode: 'url',
				sourceUrl: 'https://example.com/soup',
				aiModel: 'example/model',
			},
		});

		const recipe = await serviceFor(anonymousActor()).getRecipe(ref.slug);

		expect(recipe).toMatchObject({
			id: ref.id,
			slug: 'weeknight-chicken-soup',
			title: 'Weeknight chicken soup',
			images: [dishPhoto],
			sourceUrl: 'https://example.com/soup',
		});
		expect(recipe?.contributor).toEqual({ id: author.memberId, displayName: 'Ada' });
		expect(recipe).not.toHaveProperty('contributorId');
		expect(recipe).not.toHaveProperty('provenance');
		expect(recipe).not.toHaveProperty('entryMode');
		expect(recipe).not.toHaveProperty('aiModel');
	});

	it('returns null when no recipe has the slug', async () => {
		const reader = (await createCatalog()).serviceFor(anonymousActor());

		expect(await reader.getRecipe('buttermilk-biscuits')).toBeNull();
		expect(await reader.getRecipe('Not a slug!')).toBeNull();
	});

	it("shows the contributor's current name", async () => {
		const { members, serviceFor, author, ref } = await catalogWithBiscuits();

		await members.rename(author.memberId, 'Ada L.');

		expect((await serviceFor(anonymousActor()).getRecipe(ref.slug))?.contributor).toEqual({
			id: author.memberId,
			displayName: 'Ada L.',
		});
	});

	it('fails when the contributor has no account, which the foreign key rules out', async () => {
		const { serviceFor } = await createCatalog();
		const ref = await serviceFor(memberActor()).createRecipe(manualEntry(sampleChickenSoup));

		await expect(serviceFor(anonymousActor()).getRecipe(ref.slug)).rejects.toThrow(
			'Recipe contributor was not found'
		);
	});
});

describe('getRecipeForEditing', () => {
	it('refuses an anonymous visitor whether or not the recipe exists', async () => {
		const { serviceFor, ref } = await catalogWithBiscuits();
		const visitor = serviceFor(anonymousActor());

		await expect(visitor.getRecipeForEditing(ref.slug)).rejects.toThrow(SignInRequiredError);
		await expect(visitor.getRecipeForEditing('lemon-icebox-pie')).rejects.toThrow(
			SignInRequiredError
		);
	});

	it('refuses a member who is not the contributor', async () => {
		const { serviceFor, ref } = await catalogWithBiscuits();

		await expect(serviceFor(memberActor()).getRecipeForEditing(ref.slug)).rejects.toThrow(
			ForbiddenError
		);
	});

	it.each(['contributor', 'admin'] as const)(
		'gives the %s the whole content, scans included',
		async (editor) => {
			const { serviceFor, addMember } = await createCatalog();
			const author = await addMember('Ada');
			const content = { ...sampleChickenSoup, images: [dishPhoto, scan] };
			const ref = await serviceFor(author).createRecipe(manualEntry(content));

			const editable = await serviceFor(
				editor === 'contributor' ? author : adminActor()
			).getRecipeForEditing(ref.slug);

			expect(editable).toEqual({
				...recipeContentSchema.parse(content),
				...ref,
				updatedAt: expect.any(Date),
			});
		}
	);

	it('finds the recipe by an old slug, with its current slug', async () => {
		const { serviceFor, versionOf, author, ref } = await catalogWithBiscuits();
		const service = serviceFor(author);
		await service.updateRecipe(ref.id, sampleChickenSoup, await versionOf(ref.id));

		expect(await service.getRecipeForEditing('buttermilk-biscuits')).toMatchObject({
			id: ref.id,
			slug: 'weeknight-chicken-soup',
		});
	});

	it('returns null when no recipe has the slug', async () => {
		const member = (await createCatalog()).serviceFor(memberActor());

		expect(await member.getRecipeForEditing('buttermilk-biscuits')).toBeNull();
		expect(await member.getRecipeForEditing('Not a slug!')).toBeNull();
	});
});

describe('getRecipeMemberView', () => {
	it('returns null for an anonymous visitor', async () => {
		const { serviceFor, ref } = await catalogWithBiscuits();

		expect(await serviceFor(anonymousActor()).getRecipeMemberView(ref.slug)).toBeNull();
	});

	it.each([
		['the contributor', true],
		['an admin', true],
		['another member', false],
	] as const)('lists the scans and lets %s edit: %s', async (viewer, canEdit) => {
		const { serviceFor, addMember } = await createCatalog();
		const author = await addMember('Ada');
		const ref = await serviceFor(author).createRecipe(
			manualEntry({ ...sampleChickenSoup, images: [dishPhoto, scan] })
		);
		const actor =
			viewer === 'the contributor' ? author : viewer === 'an admin' ? adminActor() : memberActor();

		expect(await serviceFor(actor).getRecipeMemberView(ref.slug)).toEqual({
			canEdit,
			scans: [scan],
		});
	});

	it('returns null when no recipe has the slug', async () => {
		const member = (await createCatalog()).serviceFor(memberActor());

		expect(await member.getRecipeMemberView('buttermilk-biscuits')).toBeNull();
	});
});

describe('listRecipes', () => {
	it('lists recipes newest first, a page at a time, with the total', async () => {
		const { serviceFor } = await createCatalog();
		const member = serviceFor(memberActor());
		for (const content of [sampleButtermilkBiscuits, sampleChickenSoup, sampleLemonIceboxPie]) {
			await member.createRecipe(manualEntry(content));
		}
		const reader = serviceFor(anonymousActor());
		const listed = async (page: RecipePage) => {
			const { recipes, total } = await reader.listRecipes(page);
			return { titles: recipes.map(({ title }) => title), total };
		};

		expect(await listed({ limit: 2, offset: 0, sort: 'newest' })).toEqual({
			titles: ['Lemon icebox pie with a graham cracker crust', 'Weeknight chicken soup'],
			total: 3,
		});
		expect(await listed({ limit: 2, offset: 2, sort: 'newest' })).toEqual({
			titles: ['Buttermilk biscuits'],
			total: 3,
		});
		expect(await listed({ limit: 2, offset: 4, sort: 'newest' })).toEqual({ titles: [], total: 3 });
	});

	it('lists recipes A to Z by title, ignoring accents and case', async () => {
		const { serviceFor } = await createCatalog();
		const member = serviceFor(memberActor());
		for (const content of [
			sampleChickenSoup,
			{ ...sampleTomatoSalad, title: 'garden tomato salad' },
			{ ...sampleLemonIceboxPie, title: 'Éclair icebox pie' },
			sampleButtermilkBiscuits,
		]) {
			await member.createRecipe(manualEntry(content));
		}

		const { recipes } = await serviceFor(anonymousActor()).listRecipes({
			limit: 10,
			offset: 0,
			sort: 'title',
		});

		expect(recipes.map(({ title }) => title)).toEqual([
			'Buttermilk biscuits',
			'Éclair icebox pie',
			'garden tomato salad',
			'Weeknight chicken soup',
		]);
	});

	it('summarizes each recipe for its card', async () => {
		const { serviceFor } = await createCatalog();
		const ref = await serviceFor(memberActor()).createRecipe(
			manualEntry({ ...sampleChickenSoup, images: [scan, dishPhoto, secondDishPhoto] })
		);

		expect(
			await serviceFor(anonymousActor()).listRecipes({ limit: 10, offset: 0, sort: 'newest' })
		).toEqual({
			recipes: [
				{
					id: ref.id,
					slug: 'weeknight-chicken-soup',
					title: 'Weeknight chicken soup',
					source: 'Grandpa Lou',
					totalMinutes: 50,
					yield: { kind: 'servings', amount: { min: 6 } },
					tags: ['Soup', 'Weeknight'],
					coverImage: dishPhoto,
					createdAt: expect.any(Date),
				},
			],
			total: 1,
		});
	});

	it.each([
		{ limit: 0, offset: 0, sort: 'newest' },
		{ limit: 1.5, offset: 0, sort: 'newest' },
		{ limit: 101, offset: 0, sort: 'newest' },
		{ limit: 10, offset: -1, sort: 'newest' },
		{ limit: 10, offset: Number.NaN, sort: 'newest' },
		{ limit: 10, offset: 0, sort: 'oldest' },
	])('rejects the page %o', async (page) => {
		const reader = (await createCatalog()).serviceFor(anonymousActor());

		await expect(reader.listRecipes(page as RecipePage)).rejects.toThrow(InvalidRecipePageError);
	});
});

describe('createRecipe', () => {
	it('refuses an anonymous visitor', async () => {
		const reader = (await createCatalog()).serviceFor(anonymousActor());

		await expect(reader.createRecipe(manualEntry(sampleChickenSoup))).rejects.toThrow(
			SignInRequiredError
		);
		expect(await reader.listRecipes({ limit: 10, offset: 0, sort: 'newest' })).toEqual({
			recipes: [],
			total: 0,
		});
	});

	it('records the acting member as the contributor', async () => {
		const { recipes, author, ref } = await catalogWithBiscuits();

		expect((await recipes.findById(ref.id))?.contributorId).toBe(author.memberId);
	});

	it('rejects invalid content with dotted problem paths', async () => {
		const member = (await createCatalog()).serviceFor(memberActor());
		const content: RecipeContentInput = {
			...sampleChickenSoup,
			title: '  ',
			ingredientSections: [
				{ lines: [{ text: '3 to 2 carrots', amount: { min: 3, max: 2 }, item: 'carrots' }] },
			],
		};

		await expect(member.createRecipe(manualEntry(content))).rejects.toThrow(
			expect.objectContaining({
				code: 'recipe.invalid',
				problems: [
					{ path: 'title', message: expect.any(String) },
					{ path: 'ingredientSections.0.lines.0.amount.max', message: expect.any(String) },
				],
			})
		);
	});

	it('reports invalid provenance under the provenance path', async () => {
		const member = (await createCatalog()).serviceFor(memberActor());
		const input: CreateRecipeInput = {
			content: sampleChickenSoup,
			provenance: { entryMode: 'url', sourceUrl: 'ftp://example.com/soup' },
		};

		await expect(member.createRecipe(input)).rejects.toThrow(
			expect.objectContaining({
				code: 'recipe.invalid',
				problems: [{ path: 'provenance.sourceUrl', message: expect.any(String) }],
			})
		);
	});

	it.each([
		['whose upload never finished', unfinishedPhoto],
		["from another environment's folder, though stored", productionPhoto],
	])('refuses a photo %s', async (_case, photo) => {
		const member = (await createCatalog()).serviceFor(memberActor());
		const content = { ...sampleChickenSoup, images: [dishPhoto, photo] };

		await expect(member.createRecipe(manualEntry(content))).rejects.toThrow(
			expect.objectContaining({
				code: 'recipe.invalid',
				problems: [{ path: 'images.1.pathname', message: unfinishedPhotoMessage }],
			})
		);
		expect(await member.listRecipes({ limit: 10, offset: 0, sort: 'newest' })).toEqual({
			recipes: [],
			total: 0,
		});
	});

	it('reuses the label already in use for a tag and keeps the spelling of a new one', async () => {
		const { serviceFor, addMember } = await createCatalog();
		const member = serviceFor(await addMember('Ada'));
		await member.createRecipe(manualEntry({ ...sampleChickenSoup, tags: ['Weeknight', 'Soup'] }));

		const ref = await member.createRecipe(
			manualEntry({ ...sampleTomatoSalad, tags: ['WEEKNIGHT', ' soup', 'No cook'] })
		);

		expect((await member.getRecipe(ref.slug))?.tags).toEqual(['Weeknight', 'Soup', 'No cook']);
	});

	it('suffixes the slug of a title already in use', async () => {
		const member = (await createCatalog()).serviceFor(memberActor());

		const first = await member.createRecipe(manualEntry(sampleButtermilkBiscuits));
		const second = await member.createRecipe(manualEntry(sampleButtermilkBiscuits));

		expect([first.slug, second.slug]).toEqual(['buttermilk-biscuits', 'buttermilk-biscuits-2']);
	});

	it('logs the creation', async () => {
		const author = memberActor();
		const member = (await createCatalog()).serviceFor(author);

		const ref = await member.createRecipe({
			content: sampleChickenSoup,
			provenance: { entryMode: 'url', sourceUrl: 'https://example.com/soup' },
		});

		expect(logLines(consoleInfo)).toEqual([
			{
				level: 'info',
				logger: 'recipes',
				message: 'Recipe created',
				recipeId: ref.id,
				memberId: author.memberId,
				entryMode: 'url',
			},
		]);
	});
});

describe('updateRecipe', () => {
	it('refuses an anonymous visitor whether or not the recipe exists', async () => {
		const { serviceFor, ref } = await catalogWithBiscuits();
		const visitor = serviceFor(anonymousActor());

		await expect(visitor.updateRecipe(ref.id, sampleChickenSoup, anyVersion)).rejects.toThrow(
			SignInRequiredError
		);
		await expect(visitor.updateRecipe(missingId, sampleChickenSoup, anyVersion)).rejects.toThrow(
			SignInRequiredError
		);
	});

	it('refuses a member who is not the contributor, before validating the content', async () => {
		const { serviceFor, versionOf, ref } = await catalogWithBiscuits();
		const other = serviceFor(memberActor());
		const version = await versionOf(ref.id);

		await expect(other.updateRecipe(ref.id, sampleChickenSoup, version)).rejects.toThrow(
			ForbiddenError
		);
		await expect(
			other.updateRecipe(ref.id, { ...sampleChickenSoup, title: ' ' }, version)
		).rejects.toThrow(ForbiddenError);
		expect((await other.getRecipe(ref.slug))?.title).toBe('Buttermilk biscuits');
	});

	it.each(['contributor', 'admin'] as const)('lets the %s replace the content', async (editor) => {
		const { serviceFor, versionOf, author, ref } = await catalogWithBiscuits();
		const service = serviceFor(editor === 'contributor' ? author : adminActor());

		expect(
			await service.updateRecipe(
				ref.id,
				{ ...sampleChickenSoup, title: 'Buttermilk biscuits' },
				await versionOf(ref.id)
			)
		).toEqual(ref);

		const recipe = await service.getRecipe('buttermilk-biscuits');
		expect(recipe).toMatchObject({ title: 'Buttermilk biscuits', source: 'Grandpa Lou' });
		expect(recipe?.description).toBeUndefined();
	});

	it('moves the slug to follow a new title, and the previous one still finds the recipe', async () => {
		const { serviceFor, versionOf, author, ref } = await catalogWithBiscuits();
		const service = serviceFor(author);

		expect(await service.updateRecipe(ref.id, sampleChickenSoup, await versionOf(ref.id))).toEqual({
			id: ref.id,
			slug: 'weeknight-chicken-soup',
			previousSlug: 'buttermilk-biscuits',
		});
		expect(await service.getRecipe('buttermilk-biscuits')).toMatchObject({
			id: ref.id,
			slug: 'weeknight-chicken-soup',
		});
	});

	it.each(['BUTTERMILK BISCUITS', 'Buttermilk biscuits!', 'Buttermilk, biscuits'])(
		'keeps the slug when the title becomes %j',
		async (title) => {
			const { serviceFor, versionOf, author, ref } = await catalogWithBiscuits();

			const updated = await serviceFor(author).updateRecipe(
				ref.id,
				{ ...sampleButtermilkBiscuits, title },
				await versionOf(ref.id)
			);

			expect(updated).toEqual(ref);
			expect(updated).not.toHaveProperty('previousSlug');
		}
	);

	it('takes back an old slug when the title changes back', async () => {
		const { serviceFor, versionOf, author, ref } = await catalogWithBiscuits();
		const service = serviceFor(author);
		await service.updateRecipe(ref.id, sampleChickenSoup, await versionOf(ref.id));

		// Without the biscuits' photo, which the first edit removed and deleted.
		expect(
			await service.updateRecipe(
				ref.id,
				{ ...sampleButtermilkBiscuits, images: [] },
				await versionOf(ref.id)
			)
		).toEqual({
			id: ref.id,
			slug: 'buttermilk-biscuits',
			previousSlug: 'weeknight-chicken-soup',
		});
	});

	it('respells a tag that only this recipe uses', async () => {
		const { serviceFor, versionOf, author, ref } = await catalogWithBiscuits();
		const service = serviceFor(author);

		await service.updateRecipe(
			ref.id,
			{ ...sampleButtermilkBiscuits, tags: ['breakfast', 'Baking'] },
			await versionOf(ref.id)
		);

		expect((await service.getRecipe(ref.slug))?.tags).toEqual(['breakfast', 'Baking']);
	});

	it('keeps the label of a tag that another recipe also uses', async () => {
		const { serviceFor, versionOf, author, ref } = await catalogWithBiscuits();
		const service = serviceFor(author);
		await service.createRecipe(manualEntry({ ...sampleChickenSoup, tags: ['Breakfast'] }));

		await service.updateRecipe(
			ref.id,
			{ ...sampleButtermilkBiscuits, tags: ['breakfast', 'Baking'] },
			await versionOf(ref.id)
		);

		expect((await service.getRecipe(ref.slug))?.tags).toEqual(['Breakfast', 'Baking']);
	});

	it("keeps the images the recipe has, even another environment's, and checks new ones", async () => {
		const { serviceFor, versionOf, author, recipe } = await catalogWithStoredImages([
			productionPhoto,
		]);
		const service = serviceFor(author);

		await service.updateRecipe(
			recipe.id,
			{ ...sampleChickenSoup, images: [productionPhoto, dishPhoto] },
			await versionOf(recipe.id)
		);
		await expect(
			service.updateRecipe(
				recipe.id,
				{ ...sampleChickenSoup, images: [productionPhoto, dishPhoto, unfinishedPhoto] },
				await versionOf(recipe.id)
			)
		).rejects.toThrow(
			expect.objectContaining({
				problems: [{ path: 'images.2.pathname', message: unfinishedPhotoMessage }],
			})
		);
		expect((await service.getRecipe(recipe.slug))?.images).toEqual([productionPhoto, dishPhoto]);
	});

	it("deletes the photos it removes from this environment's folders, and only those", async () => {
		const { images, serviceFor, versionOf, author, recipe } = await catalogWithStoredImages([
			dishPhoto,
			secondDishPhoto,
			scan,
			productionPhoto,
		]);

		await serviceFor(author).updateRecipe(
			recipe.id,
			{ ...sampleChickenSoup, images: [secondDishPhoto] },
			await versionOf(recipe.id)
		);

		expect(images.deletedPathnames).toEqual([dishPhoto.pathname, scan.pathname]);
		expect(logLines(consoleInfo)).toContainEqual({
			level: 'info',
			logger: 'recipes',
			message: 'Recipe images deleted',
			recipeId: recipe.id,
			pathnames: [dishPhoto.pathname, scan.pathname],
		});
	});

	it('keeps a removed photo that another recipe still lists, and logs it as kept', async () => {
		const { images, service, versionOf, soup } = await catalogWithSharedPhoto();

		await service.updateRecipe(
			soup.id,
			{ ...sampleChickenSoup, images: [] },
			await versionOf(soup.id)
		);

		expect(images.deletedPathnames).toEqual([secondDishPhoto.pathname]);
		expect(logLines(consoleInfo)).toContainEqual({
			level: 'info',
			logger: 'recipes',
			message: 'Recipe images deleted',
			recipeId: soup.id,
			pathnames: [secondDishPhoto.pathname],
			keptPathnames: [dishPhoto.pathname],
		});
	});

	it('refuses a save from a copy loaded before another save, even one keeping a photo it deleted', async () => {
		const { images, serviceFor, versionOf, author, recipe } = await catalogWithStoredImages([
			dishPhoto,
			secondDishPhoto,
		]);
		const loaded = await versionOf(recipe.id);
		await serviceFor(author).updateRecipe(
			recipe.id,
			{ ...sampleChickenSoup, images: [secondDishPhoto] },
			loaded
		);

		await expect(
			serviceFor(adminActor()).updateRecipe(
				recipe.id,
				{ ...sampleChickenSoup, notes: 'Edited elsewhere.', images: [dishPhoto, secondDishPhoto] },
				loaded
			)
		).rejects.toThrow(RecipeEditConflictError);
		expect(await serviceFor(author).getRecipe(recipe.slug)).toMatchObject({
			notes: sampleChickenSoup.notes,
			images: [secondDishPhoto],
		});
		expect(images.deletedPathnames).toEqual([dishPhoto.pathname]);
	});

	it('deletes no images when it refuses a stale save', async () => {
		const { images, serviceFor, versionOf, author, recipe } = await catalogWithStoredImages([
			dishPhoto,
			secondDishPhoto,
		]);
		const loaded = await versionOf(recipe.id);
		await serviceFor(author).updateRecipe(
			recipe.id,
			{ ...sampleChickenSoup, notes: 'First edit.', images: [dishPhoto, secondDishPhoto] },
			loaded
		);

		await expect(
			serviceFor(author).updateRecipe(
				recipe.id,
				{ ...sampleChickenSoup, images: [dishPhoto] },
				loaded
			)
		).rejects.toThrow(RecipeEditConflictError);
		expect(images.deletedPathnames).toEqual([]);
		expect(logLines(consoleWarn)).toEqual([
			expect.objectContaining({
				level: 'warn',
				logger: 'recipes',
				message: 'Recipe save refused as stale',
				recipeId: recipe.id,
				memberId: author.memberId,
			}),
		]);
	});

	it.each(['', 'yesterday', '2026-10-12', '2026-10-12T00:00:00+02:00'])(
		'treats the malformed version %j as a conflict',
		async (version) => {
			const { serviceFor, author, ref } = await catalogWithBiscuits();

			await expect(
				serviceFor(author).updateRecipe(ref.id, sampleButtermilkBiscuits, version)
			).rejects.toThrow(RecipeEditConflictError);
		}
	);

	it.each([missingId, malformedId])('reports the id %s as not found', async (id) => {
		const admin = (await createCatalog()).serviceFor(adminActor());

		await expect(admin.updateRecipe(id, sampleChickenSoup, anyVersion)).rejects.toThrow(
			RecipeNotFoundError
		);
	});
});

describe('deleteRecipe', () => {
	it('refuses an anonymous visitor whether or not the recipe exists', async () => {
		const { serviceFor, ref } = await catalogWithBiscuits();
		const visitor = serviceFor(anonymousActor());

		await expect(visitor.deleteRecipe(ref.id)).rejects.toThrow(SignInRequiredError);
		await expect(visitor.deleteRecipe(missingId)).rejects.toThrow(SignInRequiredError);
	});

	it('refuses a member who is not the contributor', async () => {
		const { images, serviceFor, ref } = await catalogWithBiscuits();
		const other = serviceFor(memberActor());

		await expect(other.deleteRecipe(ref.id)).rejects.toThrow(ForbiddenError);
		expect(await other.getRecipe(ref.slug)).not.toBeNull();
		expect(images.deletedPathnames).toEqual([]);
	});

	it.each(['contributor', 'admin'] as const)('lets the %s delete the recipe', async (editor) => {
		const { serviceFor, author, ref } = await catalogWithBiscuits();
		const service = serviceFor(editor === 'contributor' ? author : adminActor());

		expect(await service.deleteRecipe(ref.id)).toEqual(ref);
		expect(await service.getRecipe(ref.slug)).toBeNull();
	});

	it("deletes the recipe's images in this environment's folders, and only those", async () => {
		const { images, serviceFor, author, recipe } = await catalogWithStoredImages([
			dishPhoto,
			productionPhoto,
			scan,
		]);

		await serviceFor(author).deleteRecipe(recipe.id);

		expect(images.deletedPathnames).toEqual([dishPhoto.pathname, scan.pathname]);
	});

	it.each(['soup', 'salad'] as const)(
		'keeps a shared photo when the %s goes first, and deletes it with the last recipe listing it',
		async (first) => {
			const { images, service, soup, salad } = await catalogWithSharedPhoto();
			const [deletedFirst, deletedLast] = first === 'soup' ? [soup, salad] : [salad, soup];

			await service.deleteRecipe(deletedFirst.id);

			expect(images.deletedPathnames).not.toContain(dishPhoto.pathname);
			expect(await images.has(dishPhoto.pathname)).toBe(true);
			expect(logLines(consoleInfo)).toContainEqual(
				expect.objectContaining({
					message: 'Recipe images deleted',
					recipeId: deletedFirst.id,
					keptPathnames: [dishPhoto.pathname],
				})
			);

			await service.deleteRecipe(deletedLast.id);

			expect(images.deletedPathnames).toContain(dishPhoto.pathname);
			expect(await images.has(dishPhoto.pathname)).toBe(false);
		}
	);

	it('reports the slug and deletes the images the recipe had when deleted, after a concurrent edit', async () => {
		const { recipes, images, serviceFor, author, recipe } = await catalogWithStoredImages([
			dishPhoto,
		]);
		const deleteStored = recipes.delete.bind(recipes);
		// Another editor retitles the recipe and swaps its photo between the service's read and delete.
		vi.spyOn(recipes, 'delete').mockImplementationOnce(async (id) => {
			await recipes.update(id, {
				content: recipeContentSchema.parse({ ...sampleTomatoSalad, images: [secondDishPhoto] }),
				expectedUpdatedAt: recipe.updatedAt,
				slugBase: 'garden-tomato-salad',
			});
			return deleteStored(id);
		});

		expect(await serviceFor(author).deleteRecipe(recipe.id)).toEqual({
			id: recipe.id,
			slug: 'garden-tomato-salad',
		});
		expect(images.deletedPathnames).toEqual([secondDishPhoto.pathname]);
	});

	it('succeeds and logs a warning when its images cannot be deleted', async () => {
		const { images, serviceFor, author, recipe } = await catalogWithStoredImages([dishPhoto]);
		images.failDeletes();
		const service = serviceFor(author);

		expect(await service.deleteRecipe(recipe.id)).toEqual({ id: recipe.id, slug: recipe.slug });
		expect(await service.getRecipe(recipe.slug)).toBeNull();
		expect(logLines(consoleWarn)).toEqual([
			expect.objectContaining({
				level: 'warn',
				logger: 'recipes',
				message: 'Recipe images could not be deleted',
				recipeId: recipe.id,
				pathnames: [dishPhoto.pathname],
				err: expect.objectContaining({ message: 'The image store could not be reached' }),
			}),
		]);
	});

	it.each([missingId, malformedId])('reports the id %s as not found', async (id) => {
		const admin = (await createCatalog()).serviceFor(adminActor());

		await expect(admin.deleteRecipe(id)).rejects.toThrow(RecipeNotFoundError);
	});
});
