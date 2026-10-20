import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { ForbiddenError, SignInRequiredError } from '@/application/authorization';
import { ImportUnavailableError } from '@/application/ingestion/errors';
import type { Actor, MemberActor } from '@/application/ports/actor-provider';
import type { ImportSuccess } from '@/application/ports/recipe-import-repository';
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
import { InMemoryFavoriteRepository } from '@/application/testing/in-memory-favorite-repository';
import { InMemoryImageStore } from '@/application/testing/in-memory-image-store';
import { InMemoryInviteRepository } from '@/application/testing/in-memory-invite-repository';
import { InMemoryMemberRepository } from '@/application/testing/in-memory-member-repository';
import { InMemoryRecipeImportRepository } from '@/application/testing/in-memory-recipe-import-repository';
import { InMemoryRecipeRepository } from '@/application/testing/in-memory-recipe-repository';
import { InMemorySavedDraftRepository } from '@/application/testing/in-memory-saved-draft-repository';
import type { Provenance } from '@/domain/recipe/provenance';
import {
	recipeContentSchema,
	type RecipeContentInput,
	type RecipeId,
} from '@/domain/recipe/recipe';
import type { RecipeImage } from '@/domain/recipe/recipe-image';
import {
	importDraftCutoff,
	type RecipeImportId,
	type RecipeImportMode,
} from '@/domain/recipe/recipe-import';
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

// The size the browser draws a landscape photo at, which every image written to a recipe has.
const photoSize = { width: 2400, height: 1800 };
const dishPhoto: RecipeImage = {
	role: 'dish',
	pathname: 'dish/seed/soup.jpg',
	alt: 'A bowl of soup',
	size: photoSize,
};
const secondDishPhoto: RecipeImage = {
	role: 'dish',
	pathname: 'dish/seed/soup-pot.jpg',
	size: photoSize,
};
const scan: RecipeImage = { role: 'scan', pathname: 'scan/seed/soup-card.jpg', size: photoSize };
// Another environment's, as production's photos are for a preview's copied recipes.
const productionPhoto: RecipeImage = {
	role: 'dish',
	pathname: 'dish/production/soup.jpg',
	size: photoSize,
};
// In this environment's folder, but its upload never finished.
const unfinishedPhoto: RecipeImage = {
	role: 'dish',
	pathname: 'dish/seed/half-sent.jpg',
	size: photoSize,
};

const unstoredImageMessage = 'This photo didn’t upload. Remove it and add it again.';

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

const unavailableImportId = '0199c7a4-2c3e-7b1a-9f00-2a7c1e4b5d70';

// What each mode's import recorded for review. A photo import's draft keeps the scan it read.
const importResults: Record<RecipeImportMode, ImportSuccess> = {
	url: {
		draft: { content: { title: 'Weeknight chicken soup' }, problems: [] },
		sourceUrl: 'https://example.com/soup',
		aiModel: 'example/model',
		costUsd: 0.0042,
	},
	photo: {
		draft: { content: { title: 'Weeknight chicken soup', images: [scan] }, problems: [] },
		aiModel: 'example/vision-model',
		costUsd: 0.012,
	},
};

// What a draft saved from the URL import's review keeps of the import.
const urlImportProvenance: Provenance = {
	entryMode: 'url',
	sourceUrl: 'https://example.com/soup',
	aiModel: 'example/model',
};

function manualEntry(content: RecipeContentInput): CreateRecipeInput {
	return { content };
}

// One catalog, with a service per actor. Every photo but the unfinished one is stored.
async function createCatalog() {
	const recipes = new InMemoryRecipeRepository();
	const imports = new InMemoryRecipeImportRepository(recipes);
	const drafts = new InMemorySavedDraftRepository();
	const members = new InMemoryMemberRepository(
		new InMemoryInviteRepository(),
		new InMemoryFavoriteRepository(recipes),
		drafts
	);
	const images = new InMemoryImageStore(folders);
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
		new RecipeService(
			recipes,
			imports,
			drafts,
			members,
			images,
			new FixedActorProvider(actor),
			folders
		);
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
	// An import the member started that is still running, as a failed or unfinished one stays.
	const startImport = async (actor: MemberActor, mode: RecipeImportMode = 'url') => {
		const started = await imports.start({ memberId: actor.memberId, mode });
		if (started === null) {
			throw new Error('The import was refused');
		}
		return started.id;
	};
	// An import the member started whose draft awaits their review.
	const importDraft = async (actor: MemberActor, mode: RecipeImportMode = 'url') => {
		const id = await startImport(actor, mode);
		await imports.recordSuccess(id, importResults[mode]);
		return id;
	};
	// A draft the member saved from the recipe form, naming the images, and from an import's review,
	// keeping its provenance.
	const saveDraft = async (
		actor: MemberActor,
		imagePathnames: string[] = [],
		importId?: RecipeImportId,
		provenance?: Provenance
	) => {
		const draft = await drafts.create({
			memberId: actor.memberId,
			...(importId !== undefined && { importId }),
			...(provenance !== undefined && { provenance }),
			values: {},
			imagePathnames,
		});
		if (draft === null) {
			throw new Error('The draft was refused');
		}
		return draft.id;
	};
	return {
		recipes,
		imports,
		drafts,
		members,
		images,
		serviceFor,
		saveDraft,
		addMember,
		versionOf,
		startImport,
		importDraft,
	};
}

// Saves the sample soup from the import, as the review form does.
function fromImport(importId: string, content: RecipeContentInput = sampleChickenSoup) {
	return { content, importId };
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
		const { recipes, imports, drafts, members, images, serviceFor, addMember } =
			await createCatalog();
		const ref = await serviceFor(await addMember('Ada')).createRecipe(
			manualEntry(sampleTomatoSalad)
		);
		const actors = new FixedActorProvider(memberActor());
		const reader = new RecipeService(recipes, imports, drafts, members, images, actors, folders);

		await reader.getRecipe(ref.slug);
		await reader.listRecipes({ limit: 10, offset: 0, sort: 'newest' });
		await reader.listTagLabels();
		await reader.listRecipeIds();

		expect(actors.wasAsked).toBe(false);
	});
});

describe('getRecipe', () => {
	it("shows dish photos and scans apart, the source URL, and the contributor's name, but no entry details", async () => {
		const { serviceFor, addMember, importDraft } = await createCatalog();
		const author = await addMember('Ada');
		const ref = await serviceFor(author).createRecipe(
			fromImport(await importDraft(author), { ...sampleChickenSoup, images: [scan, dishPhoto] })
		);

		const recipe = await serviceFor(anonymousActor()).getRecipe(ref.slug);

		expect(recipe).toMatchObject({
			id: ref.id,
			slug: 'weeknight-chicken-soup',
			title: 'Weeknight chicken soup',
			images: [dishPhoto],
			scans: [scan],
			sourceUrl: 'https://example.com/soup',
		});
		expect(recipe?.contributor).toEqual({ id: author.memberId, displayName: 'Ada' });
		expect(recipe).not.toHaveProperty('contributorId');
		expect(recipe).not.toHaveProperty('provenance');
		expect(recipe).not.toHaveProperty('entryMode');
		expect(recipe).not.toHaveProperty('aiModel');
	});

	it.each(['manual', 'photo'] as const)(
		'links a source entered as a web address on a recipe entered by %s, as an import’s page links',
		async (mode) => {
			const { serviceFor, addMember, importDraft } = await createCatalog();
			const author = await addMember('Ada');
			const content = { ...sampleChickenSoup, source: 'http://example.com/soup' };
			const ref = await serviceFor(author).createRecipe(
				mode === 'manual'
					? manualEntry(content)
					: fromImport(await importDraft(author, mode), content)
			);

			expect(await serviceFor(anonymousActor()).getRecipe(ref.slug)).toMatchObject({
				source: 'http://example.com/soup',
				sourceUrl: 'http://example.com/soup',
			});
		}
	);

	it.each([
		'Grandma Rose',
		'example.com/soup',
		'ftp://example.com/soup',
		'From https://example.com/soup',
	])('links no source that is not a web address alone: %s', async (source) => {
		const { serviceFor, addMember } = await createCatalog();
		const ref = await serviceFor(await addMember('Ada')).createRecipe(
			manualEntry({ ...sampleChickenSoup, source })
		);

		const recipe = await serviceFor(anonymousActor()).getRecipe(ref.slug);

		expect(recipe?.source).toBe(source);
		expect(recipe?.sourceUrl).toBeUndefined();
	});

	it('links the page an import read, whatever web address its source names', async () => {
		const { serviceFor, addMember, importDraft } = await createCatalog();
		const author = await addMember('Ada');
		const ref = await serviceFor(author).createRecipe(
			fromImport(await importDraft(author), {
				...sampleChickenSoup,
				source: 'https://example.com/grandma',
			})
		);

		expect((await serviceFor(anonymousActor()).getRecipe(ref.slug))?.sourceUrl).toBe(
			'https://example.com/soup'
		);
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
				respellableTags: ['Soup', 'Weeknight'],
			});
		}
	);

	it("names the recipe's tags that no other recipe uses, which an edit can respell", async () => {
		const { serviceFor, author, ref } = await catalogWithBiscuits();
		const service = serviceFor(author);
		await service.createRecipe(manualEntry({ ...sampleChickenSoup, tags: ['breakfast'] }));

		expect((await service.getRecipeForEditing(ref.slug))?.respellableTags).toEqual(['Baking']);
	});

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
	] as const)('lets %s edit: %s', async (viewer, canEdit) => {
		const { serviceFor, addMember } = await createCatalog();
		const author = await addMember('Ada');
		const ref = await serviceFor(author).createRecipe(
			manualEntry({ ...sampleChickenSoup, images: [dishPhoto, scan] })
		);
		const actor =
			viewer === 'the contributor' ? author : viewer === 'an admin' ? adminActor() : memberActor();

		expect(await serviceFor(actor).getRecipeMemberView(ref.slug)).toEqual({ canEdit });
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
					chapter: 'soups-salads',
					holidays: [],
					diets: [],
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

describe('listTagLabels', () => {
	it('lists the label of every tag in use, most used first', async () => {
		const { serviceFor, addMember } = await createCatalog();
		const member = serviceFor(await addMember('Ada'));
		await member.createRecipe(manualEntry(sampleButtermilkBiscuits));
		await member.createRecipe(manualEntry({ ...sampleChickenSoup, tags: ['baking', 'Soup'] }));

		expect(await serviceFor(anonymousActor()).listTagLabels()).toEqual([
			'Baking',
			'Breakfast',
			'Soup',
		]);
	});
});

describe('listRecipeIds', () => {
	it('lists every recipe’s id, newest first, and no longer one deleted', async () => {
		const { serviceFor, addMember } = await createCatalog();
		const member = serviceFor(await addMember('Ada'));
		const biscuits = await member.createRecipe(manualEntry(sampleButtermilkBiscuits));
		const soup = await member.createRecipe(manualEntry(sampleChickenSoup));
		const salad = await member.createRecipe(manualEntry(sampleTomatoSalad));
		await member.deleteRecipe(soup.id);

		expect(await serviceFor(anonymousActor()).listRecipeIds()).toEqual([salad.id, biscuits.id]);
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

	it.each([
		['whose upload never finished', unfinishedPhoto],
		["from another environment's folder, though stored", productionPhoto],
	])('refuses a photo %s', async (_case, photo) => {
		const member = (await createCatalog()).serviceFor(memberActor());
		const content = { ...sampleChickenSoup, images: [dishPhoto, photo] };

		await expect(member.createRecipe(manualEntry(content))).rejects.toThrow(
			expect.objectContaining({
				code: 'recipe.invalid',
				problems: [{ path: 'images.1.pathname', message: unstoredImageMessage }],
			})
		);
		expect(await member.listRecipes({ limit: 10, offset: 0, sort: 'newest' })).toEqual({
			recipes: [],
			total: 0,
		});
	});

	it("refuses a photo or scan another member's recipe or draft names, as never uploaded", async () => {
		const { serviceFor, addMember, importDraft } = await createCatalog();
		const owner = await addMember('Ada');
		await serviceFor(owner).createRecipe(
			manualEntry({ ...sampleChickenSoup, images: [dishPhoto] })
		);
		// The draft names the scan it was read from.
		await importDraft(owner, 'photo');
		const member = serviceFor(await addMember('Lou'));
		const content = { ...sampleTomatoSalad, images: [secondDishPhoto, dishPhoto, scan] };

		await expect(member.createRecipe(manualEntry(content))).rejects.toThrow(
			expect.objectContaining({
				code: 'recipe.invalid',
				problems: [
					{ path: 'images.1.pathname', message: unstoredImageMessage },
					{ path: 'images.2.pathname', message: unstoredImageMessage },
				],
			})
		);
	});

	it("refuses a photo another member's saved draft names, as never uploaded", async () => {
		const { serviceFor, addMember, saveDraft } = await createCatalog();
		await saveDraft(await addMember('Ada'), [secondDishPhoto.pathname]);
		const member = serviceFor(await addMember('Lou'));

		await expect(
			member.createRecipe(manualEntry({ ...sampleTomatoSalad, images: [secondDishPhoto] }))
		).rejects.toThrow(
			expect.objectContaining({
				code: 'recipe.invalid',
				problems: [{ path: 'images.0.pathname', message: unstoredImageMessage }],
			})
		);
	});

	it('deletes the draft the recipe was saved from, and never another member’s', async () => {
		const { drafts, serviceFor, addMember, saveDraft } = await createCatalog();
		const author = await addMember('Ada');
		const other = await addMember('Lou');
		const draftId = await saveDraft(author, [secondDishPhoto.pathname]);
		const othersDraftId = await saveDraft(other);

		await serviceFor(author).createRecipe({
			content: { ...sampleTomatoSalad, images: [secondDishPhoto] },
			draftId,
		});
		await serviceFor(author).createRecipe({ content: sampleChickenSoup, draftId: othersDraftId });

		expect(await drafts.findById(draftId)).toBeNull();
		expect(await drafts.findById(othersDraftId)).not.toBeNull();
	});

	it("reuses the member's own photos and scans from their recipes and drafts", async () => {
		const { serviceFor, addMember, importDraft } = await createCatalog();
		const owner = await addMember('Ada');
		const service = serviceFor(owner);
		await service.createRecipe(manualEntry({ ...sampleChickenSoup, images: [dishPhoto] }));
		await importDraft(owner, 'photo');

		const ref = await service.createRecipe(
			manualEntry({ ...sampleTomatoSalad, images: [dishPhoto, scan] })
		);

		expect((await service.getRecipeForEditing(ref.slug))?.images).toEqual([dishPhoto, scan]);
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

	it("takes the earliest recipe's spelling of a tag saved in two, as racing saves can leave it", async () => {
		const { recipes, serviceFor, addMember } = await createCatalog();
		const author = await addMember('Ada');
		for (const [input, tags] of [
			[sampleChickenSoup, ['Weeknight']],
			[sampleLemonIceboxPie, ['WEEKNIGHT']],
		] as const) {
			const content = recipeContentSchema.parse({ ...input, tags });
			await recipes.create({
				content,
				provenance: { entryMode: 'manual' },
				contributorId: author.memberId,
				slugBase: slugify(content.title),
			});
		}
		const member = serviceFor(author);

		const ref = await member.createRecipe(
			manualEntry({ ...sampleTomatoSalad, tags: ['weeknight'] })
		);

		expect((await member.getRecipe(ref.slug))?.tags).toEqual(['Weeknight']);
	});

	it('suffixes the slug of a title already in use', async () => {
		const member = (await createCatalog()).serviceFor(memberActor());

		const first = await member.createRecipe(manualEntry(sampleButtermilkBiscuits));
		const second = await member.createRecipe(manualEntry(sampleButtermilkBiscuits));

		expect([first.slug, second.slug]).toEqual(['buttermilk-biscuits', 'buttermilk-biscuits-2']);
	});

	it('saves manual entry as such, and logs the creation', async () => {
		const author = memberActor();
		const { recipes, serviceFor } = await createCatalog();

		const ref = await serviceFor(author).createRecipe(manualEntry(sampleChickenSoup));

		expect((await recipes.findById(ref.id))?.provenance).toEqual({ entryMode: 'manual' });
		expect(logLines(consoleInfo)).toEqual([
			{
				level: 'info',
				logger: 'recipes',
				message: 'Recipe created',
				recipeId: ref.id,
				memberId: author.memberId,
				entryMode: 'manual',
			},
		]);
	});
});

describe('createRecipe from an import', () => {
	it("takes a URL import's provenance from the import, and logs the import", async () => {
		const author = memberActor();
		const { recipes, serviceFor, importDraft } = await createCatalog();
		const importId = await importDraft(author);

		const ref = await serviceFor(author).createRecipe(fromImport(importId));

		expect((await recipes.findById(ref.id))?.provenance).toEqual({
			entryMode: 'url',
			sourceUrl: 'https://example.com/soup',
			aiModel: 'example/model',
		});
		expect(logLines(consoleInfo)).toEqual([
			{
				level: 'info',
				logger: 'recipes',
				message: 'Recipe created',
				recipeId: ref.id,
				memberId: author.memberId,
				entryMode: 'url',
				importId,
			},
		]);
	});

	it("takes a photo import's provenance from the import", async () => {
		const author = memberActor();
		const { recipes, serviceFor, importDraft } = await createCatalog();

		const ref = await serviceFor(author).createRecipe(
			fromImport(await importDraft(author, 'photo'))
		);

		expect((await recipes.findById(ref.id))?.provenance).toEqual({
			entryMode: 'photo',
			aiModel: 'example/vision-model',
		});
	});

	it('clears the draft and source URL once the recipe is saved, and keeps the record', async () => {
		const author = memberActor();
		const { imports, serviceFor, importDraft } = await createCatalog();
		const importId = await importDraft(author);

		const ref = await serviceFor(author).createRecipe(fromImport(importId));

		const recipeImport = await imports.findById(importId);
		expect(recipeImport).toMatchObject({
			status: 'succeeded',
			aiModel: 'example/model',
			costUsd: 0.0042,
			savedRecipeSlug: ref.slug,
		});
		expect(recipeImport).not.toHaveProperty('draft');
		expect(recipeImport).not.toHaveProperty('sourceUrl');
	});

	it("deletes the draft that continued the import's review", async () => {
		const author = memberActor();
		const { drafts, serviceFor, importDraft, saveDraft } = await createCatalog();
		const importId = await importDraft(author);
		const draftId = await saveDraft(author, [], importId);

		await serviceFor(author).createRecipe(fromImport(importId));

		expect(await drafts.findById(draftId)).toBeNull();
	});

	it('refuses a second save from the import', async () => {
		const author = memberActor();
		const { recipes, serviceFor, importDraft } = await createCatalog();
		const importId = await importDraft(author);
		await serviceFor(author).createRecipe(fromImport(importId));

		await expect(
			serviceFor(author).createRecipe(fromImport(importId, sampleTomatoSalad))
		).rejects.toThrow(ImportUnavailableError);
		expect(await recipes.count()).toBe(1);
	});

	it('refuses a second save that raced past the check, and keeps the first', async () => {
		const author = memberActor();
		const { recipes, imports, serviceFor, importDraft } = await createCatalog();
		const importId = await importDraft(author);
		const unsaved = await imports.findById(importId);
		await serviceFor(author).createRecipe(fromImport(importId));
		// The second save read the import before the first one committed.
		vi.spyOn(imports, 'findById').mockResolvedValueOnce(unsaved);

		await expect(
			serviceFor(author).createRecipe(fromImport(importId, sampleTomatoSalad))
		).rejects.toThrow(ImportUnavailableError);
		expect(await recipes.count()).toBe(1);
		expect(logLines(consoleWarn)).toEqual([
			{
				level: 'warn',
				logger: 'recipes',
				message: 'Recipe save refused for an unavailable import',
				importId,
				memberId: author.memberId,
			},
		]);
	});

	it.each(['another member', 'an admin'] as const)(
		"refuses a member's import when %s saves it, and saves nothing",
		async (saver) => {
			const { recipes, serviceFor, importDraft } = await createCatalog();
			const importId = await importDraft(memberActor());
			const actor = saver === 'an admin' ? adminActor() : memberActor();

			await expect(serviceFor(actor).createRecipe(fromImport(importId))).rejects.toThrow(
				ImportUnavailableError
			);
			expect(await recipes.count()).toBe(0);
			expect(logLines(consoleWarn)).toEqual([
				expect.objectContaining({
					message: 'Recipe save refused for an unavailable import',
					importId,
					memberId: actor.memberId,
				}),
			]);
		}
	);

	it.each<{
		state: string;
		finish: (imports: InMemoryRecipeImportRepository, id: RecipeImportId) => Promise<void>;
	}>([
		{ state: 'still running', finish: async () => {} },
		{
			state: 'that failed',
			finish: async (imports, id) => {
				await imports.recordFailure(id, { failure: 'import.failed' });
			},
		},
		{
			state: 'whose draft was cleared',
			finish: async (imports, id) => {
				await imports.recordSuccess(id, importResults.url);
				await imports.clearDraft(id);
			},
		},
		{
			state: 'whose draft expired',
			finish: async (imports, id) => {
				await imports.recordSuccess(id, importResults.url);
				imports.backdate(id, new Date(importDraftCutoff(new Date()).getTime() - 1000));
			},
		},
	])('refuses an import $state, and saves nothing', async ({ finish }) => {
		const author = memberActor();
		const { recipes, imports, serviceFor, startImport } = await createCatalog();
		const importId = await startImport(author);
		await finish(imports, importId);

		await expect(serviceFor(author).createRecipe(fromImport(importId))).rejects.toThrow(
			ImportUnavailableError
		);
		expect(await recipes.count()).toBe(0);
	});

	it.each([unavailableImportId, 'not-an-import-id'])(
		'refuses the import id %s, which names no import',
		async (importId) => {
			const author = memberActor();
			const { recipes, serviceFor } = await createCatalog();

			await expect(serviceFor(author).createRecipe(fromImport(importId))).rejects.toThrow(
				ImportUnavailableError
			);
			expect(await recipes.count()).toBe(0);
		}
	);

	it('checks the import before the content, which no edit could make saveable', async () => {
		const author = memberActor();
		const { serviceFor, startImport } = await createCatalog();
		const importId = await startImport(author);

		await expect(
			serviceFor(author).createRecipe(fromImport(importId, { ...sampleChickenSoup, title: ' ' }))
		).rejects.toThrow(ImportUnavailableError);
	});

	it('succeeds and logs a warning when the draft cannot be cleared', async () => {
		const author = memberActor();
		const { recipes, imports, serviceFor, importDraft } = await createCatalog();
		const importId = await importDraft(author);
		vi.spyOn(imports, 'clearDraft').mockRejectedValueOnce(
			new Error('The database could not be reached')
		);

		const ref = await serviceFor(author).createRecipe(fromImport(importId));

		expect(await recipes.findById(ref.id)).not.toBeNull();
		expect(logLines(consoleWarn)).toEqual([
			expect.objectContaining({
				level: 'warn',
				logger: 'recipes',
				message: 'Import draft could not be cleared',
				importId,
				recipeId: ref.id,
				err: expect.objectContaining({ message: 'The database could not be reached' }),
			}),
		]);
	});
});

describe('createRecipe from a saved draft', () => {
	it("takes the provenance the member's draft kept once the import's review is gone, and credits its page", async () => {
		const { recipes, imports, drafts, serviceFor, addMember, importDraft, saveDraft } =
			await createCatalog();
		const author = await addMember('Ada');
		const importId = await importDraft(author);
		const draftId = await saveDraft(author, [], importId, urlImportProvenance);
		await imports.clearDraft(importId);

		const ref = await serviceFor(author).createRecipe({ content: sampleChickenSoup, draftId });

		expect((await recipes.findById(ref.id))?.provenance).toEqual(urlImportProvenance);
		expect((await serviceFor(author).getRecipe(ref.slug))?.sourceUrl).toBe(
			'https://example.com/soup'
		);
		expect(await drafts.findById(draftId)).toBeNull();
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

	it.each<{ name: string; draftId: (ids: { theirs: string }) => string }>([
		{ name: "another member's draft", draftId: ({ theirs }) => theirs },
		{ name: 'an id no draft has', draftId: () => missingId },
		{ name: 'a malformed id', draftId: () => malformedId },
	])('saves manual entry from $name', async ({ draftId }) => {
		const author = memberActor();
		const other = memberActor();
		const { recipes, serviceFor, importDraft, saveDraft } = await createCatalog();
		const theirs = await saveDraft(other, [], await importDraft(other), urlImportProvenance);

		const ref = await serviceFor(author).createRecipe({
			content: sampleChickenSoup,
			draftId: draftId({ theirs }),
		});

		expect((await recipes.findById(ref.id))?.provenance).toEqual({ entryMode: 'manual' });
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
		).toEqual({
			...ref,
			releasedImages: { recipeId: ref.id, images: sampleButtermilkBiscuits.images },
		});

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
			releasedImages: { recipeId: ref.id, images: sampleButtermilkBiscuits.images },
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

			expect(updated).toEqual({ ...ref, releasedImages: { recipeId: ref.id, images: [] } });
			expect(updated).not.toHaveProperty('previousSlug');
		}
	);

	it('takes back an old slug when the title changes back', async () => {
		const { serviceFor, versionOf, author, ref } = await catalogWithBiscuits();
		const service = serviceFor(author);
		await service.updateRecipe(ref.id, sampleChickenSoup, await versionOf(ref.id));

		expect(
			await service.updateRecipe(ref.id, sampleButtermilkBiscuits, await versionOf(ref.id))
		).toEqual({
			id: ref.id,
			slug: 'buttermilk-biscuits',
			previousSlug: 'weeknight-chicken-soup',
			releasedImages: { recipeId: ref.id, images: sampleChickenSoup.images },
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
				problems: [{ path: 'images.2.pathname', message: unstoredImageMessage }],
			})
		);
		expect((await service.getRecipe(recipe.slug))?.images).toEqual([productionPhoto, dishPhoto]);
	});

	it("refuses to add a photo another member's recipe lists, as never uploaded", async () => {
		const { serviceFor, addMember, versionOf, author, recipe } = await catalogWithStoredImages([
			dishPhoto,
		]);
		await serviceFor(await addMember('Lou')).createRecipe(
			manualEntry({ ...sampleTomatoSalad, images: [secondDishPhoto] })
		);

		await expect(
			serviceFor(author).updateRecipe(
				recipe.id,
				{ ...sampleChickenSoup, images: [dishPhoto, secondDishPhoto] },
				await versionOf(recipe.id)
			)
		).rejects.toThrow(
			expect.objectContaining({
				problems: [{ path: 'images.1.pathname', message: unstoredImageMessage }],
			})
		);
	});

	it("lets an admin keep the recipe's images and add the contributor's, but not another member's", async () => {
		const { images, serviceFor, addMember, versionOf, author, recipe } =
			await catalogWithStoredImages([dishPhoto]);
		const admin = serviceFor(adminActor());
		const adminPhoto: RecipeImage = {
			role: 'dish',
			pathname: 'dish/seed/salad.jpg',
			size: photoSize,
		};
		await images.put(adminPhoto.pathname, jpeg, 'image/jpeg');
		await admin.createRecipe(manualEntry({ ...sampleTomatoSalad, images: [adminPhoto] }));
		await serviceFor(author).createRecipe(
			manualEntry({ ...sampleLemonIceboxPie, images: [secondDishPhoto] })
		);
		await serviceFor(await addMember('Lou')).createRecipe(
			manualEntry({ ...sampleButtermilkBiscuits, images: [scan] })
		);

		await admin.updateRecipe(
			recipe.id,
			{ ...sampleChickenSoup, images: [dishPhoto, secondDishPhoto] },
			await versionOf(recipe.id)
		);
		await expect(
			admin.updateRecipe(
				recipe.id,
				{ ...sampleChickenSoup, images: [dishPhoto, secondDishPhoto, adminPhoto, scan] },
				await versionOf(recipe.id)
			)
		).rejects.toThrow(
			expect.objectContaining({
				problems: [
					{ path: 'images.2.pathname', message: unstoredImageMessage },
					{ path: 'images.3.pathname', message: unstoredImageMessage },
				],
			})
		);
		expect((await admin.getRecipe(recipe.slug))?.images).toEqual([dishPhoto, secondDishPhoto]);
	});

	it('returns the images it drops as released, from every environment, and removes none itself', async () => {
		const { images, serviceFor, versionOf, author, recipe } = await catalogWithStoredImages([
			dishPhoto,
			secondDishPhoto,
			scan,
			productionPhoto,
		]);

		const updated = await serviceFor(author).updateRecipe(
			recipe.id,
			{ ...sampleChickenSoup, images: [secondDishPhoto] },
			await versionOf(recipe.id)
		);

		expect(updated.releasedImages).toEqual({
			recipeId: recipe.id,
			images: [dishPhoto, scan, productionPhoto],
		});
		expect(images.removedPathnames).toEqual([]);
	});

	it('refuses a save from a copy loaded before another save, even one keeping a photo it let go', async () => {
		const { serviceFor, versionOf, author, recipe } = await catalogWithStoredImages([
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
	});

	it('logs a stale save it refuses', async () => {
		const { serviceFor, versionOf, author, recipe } = await catalogWithStoredImages([
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
		const { serviceFor, ref } = await catalogWithBiscuits();
		const other = serviceFor(memberActor());

		await expect(other.deleteRecipe(ref.id)).rejects.toThrow(ForbiddenError);
		expect(await other.getRecipe(ref.slug)).not.toBeNull();
	});

	it.each(['contributor', 'admin'] as const)('lets the %s delete the recipe', async (editor) => {
		const { serviceFor, author, ref } = await catalogWithBiscuits();
		const service = serviceFor(editor === 'contributor' ? author : adminActor());

		expect(await service.deleteRecipe(ref.id)).toEqual({
			...ref,
			releasedImages: { recipeId: ref.id, images: sampleButtermilkBiscuits.images },
		});
		expect(await service.getRecipe(ref.slug)).toBeNull();
	});

	it('returns every image the recipe had as released, from every environment, and removes none itself', async () => {
		const { images, serviceFor, author, recipe } = await catalogWithStoredImages([
			dishPhoto,
			productionPhoto,
			scan,
		]);

		const deleted = await serviceFor(author).deleteRecipe(recipe.id);

		expect(deleted.releasedImages).toEqual({
			recipeId: recipe.id,
			images: [dishPhoto, productionPhoto, scan],
		});
		expect(images.removedPathnames).toEqual([]);
	});

	it('reports the slug and releases the images the recipe had when deleted, after a concurrent edit', async () => {
		const { recipes, serviceFor, author, recipe } = await catalogWithStoredImages([dishPhoto]);
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
			releasedImages: { recipeId: recipe.id, images: [secondDishPhoto] },
		});
	});

	it.each([missingId, malformedId])('reports the id %s as not found', async (id) => {
		const admin = (await createCatalog()).serviceFor(adminActor());

		await expect(admin.deleteRecipe(id)).rejects.toThrow(RecipeNotFoundError);
	});
});
