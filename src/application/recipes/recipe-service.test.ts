import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { ForbiddenError, SignInRequiredError } from '@/application/authorization';
import type { Actor } from '@/application/ports/actor-provider';
import type { RecipePage } from '@/application/ports/recipe-repository';
import { InvalidRecipePageError, RecipeNotFoundError } from '@/application/recipes/errors';
import { RecipeService, type CreateRecipeInput } from '@/application/recipes/recipe-service';
import { adminActor, anonymousActor, memberActor } from '@/application/testing/actors';
import { FixedActorProvider } from '@/application/testing/fixed-actor-provider';
import { InMemoryRecipeRepository } from '@/application/testing/in-memory-recipe-repository';
import type { RecipeContentInput } from '@/domain/recipe/recipe';
import type { RecipeImage } from '@/domain/recipe/recipe-image';
import {
	sampleButtermilkBiscuits,
	sampleChickenSoup,
	sampleLemonIceboxPie,
	sampleTomatoSalad,
} from '@/domain/recipe/samples/sample-recipes';

const missingId = '0199c7a4-2c3e-7b1a-9f00-2a7c1e4b5d6e';
const malformedId = 'not-a-recipe-id';

const dishPhoto: RecipeImage = { role: 'dish', pathname: 'dish/soup.jpg', alt: 'A bowl of soup' };
const secondDishPhoto: RecipeImage = { role: 'dish', pathname: 'dish/soup-pot.jpg' };
const scan: RecipeImage = { role: 'scan', pathname: 'scan/soup-card.jpg' };

function manualEntry(content: RecipeContentInput): CreateRecipeInput {
	return { content, provenance: { entryMode: 'manual' } };
}

// One catalog, with a service per actor.
function createCatalog() {
	const recipes = new InMemoryRecipeRepository();
	const serviceFor = (actor: Actor) => new RecipeService(recipes, new FixedActorProvider(actor));
	return { recipes, serviceFor };
}

async function catalogWithBiscuits() {
	const catalog = createCatalog();
	const author = memberActor();
	const ref = await catalog.serviceFor(author).createRecipe(manualEntry(sampleButtermilkBiscuits));
	return { ...catalog, author, ref };
}

let consoleInfo: MockInstance<typeof console.info>;

beforeEach(() => {
	// Keeps lifecycle log lines out of the test output; the logging test reads them here.
	consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => {});
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('public reads', () => {
	it('never ask who is calling, so pages can cache them', async () => {
		const { recipes, serviceFor } = createCatalog();
		const ref = await serviceFor(memberActor()).createRecipe(manualEntry(sampleTomatoSalad));
		const actors = new FixedActorProvider(memberActor());
		const reader = new RecipeService(recipes, actors);

		await reader.getRecipe(ref.slug);
		await reader.listRecipes({ limit: 10, offset: 0 });

		expect(actors.wasAsked).toBe(false);
	});
});

describe('getRecipe', () => {
	it('shows dish photos and the source URL, but no scans, contributor, or entry details', async () => {
		const { serviceFor } = createCatalog();
		const ref = await serviceFor(memberActor()).createRecipe({
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
		expect(recipe).not.toHaveProperty('contributorId');
		expect(recipe).not.toHaveProperty('provenance');
		expect(recipe).not.toHaveProperty('entryMode');
		expect(recipe).not.toHaveProperty('aiModel');
	});

	it('returns null when no recipe has the slug', async () => {
		const reader = createCatalog().serviceFor(anonymousActor());

		expect(await reader.getRecipe('buttermilk-biscuits')).toBeNull();
		expect(await reader.getRecipe('Not a slug!')).toBeNull();
	});
});

describe('listRecipes', () => {
	it('lists recipes newest first, a page at a time, with the total', async () => {
		const { serviceFor } = createCatalog();
		const member = serviceFor(memberActor());
		for (const content of [sampleButtermilkBiscuits, sampleChickenSoup, sampleLemonIceboxPie]) {
			await member.createRecipe(manualEntry(content));
		}
		const reader = serviceFor(anonymousActor());
		const listed = async (page: RecipePage) => {
			const { recipes, total } = await reader.listRecipes(page);
			return { titles: recipes.map(({ title }) => title), total };
		};

		expect(await listed({ limit: 2, offset: 0 })).toEqual({
			titles: ['Lemon icebox pie with a graham cracker crust', 'Weeknight chicken soup'],
			total: 3,
		});
		expect(await listed({ limit: 2, offset: 2 })).toEqual({
			titles: ['Buttermilk biscuits'],
			total: 3,
		});
		expect(await listed({ limit: 2, offset: 4 })).toEqual({ titles: [], total: 3 });
	});

	it('summarizes each recipe for its card', async () => {
		const { serviceFor } = createCatalog();
		const ref = await serviceFor(memberActor()).createRecipe(
			manualEntry({ ...sampleChickenSoup, images: [scan, dishPhoto, secondDishPhoto] })
		);

		expect(await serviceFor(anonymousActor()).listRecipes({ limit: 10, offset: 0 })).toEqual({
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
		{ limit: 0, offset: 0 },
		{ limit: 1.5, offset: 0 },
		{ limit: 101, offset: 0 },
		{ limit: 10, offset: -1 },
		{ limit: 10, offset: Number.NaN },
	])('rejects the page %o', async (page) => {
		const reader = createCatalog().serviceFor(anonymousActor());

		await expect(reader.listRecipes(page)).rejects.toThrow(InvalidRecipePageError);
	});
});

describe('createRecipe', () => {
	it('refuses an anonymous visitor', async () => {
		const reader = createCatalog().serviceFor(anonymousActor());

		await expect(reader.createRecipe(manualEntry(sampleChickenSoup))).rejects.toThrow(
			SignInRequiredError
		);
		expect(await reader.listRecipes({ limit: 10, offset: 0 })).toEqual({ recipes: [], total: 0 });
	});

	it('records the acting member as the contributor', async () => {
		const { recipes, author, ref } = await catalogWithBiscuits();

		expect((await recipes.findById(ref.id))?.contributorId).toBe(author.memberId);
	});

	it('rejects invalid content with dotted problem paths', async () => {
		const member = createCatalog().serviceFor(memberActor());
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
		const member = createCatalog().serviceFor(memberActor());
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

	it('reuses the label already in use for a tag and keeps the spelling of a new one', async () => {
		const member = createCatalog().serviceFor(memberActor());
		await member.createRecipe(manualEntry({ ...sampleChickenSoup, tags: ['Weeknight', 'Soup'] }));

		const ref = await member.createRecipe(
			manualEntry({ ...sampleTomatoSalad, tags: ['WEEKNIGHT', ' soup', 'No cook'] })
		);

		expect((await member.getRecipe(ref.slug))?.tags).toEqual(['Weeknight', 'Soup', 'No cook']);
	});

	it('suffixes the slug of a title already in use', async () => {
		const member = createCatalog().serviceFor(memberActor());

		const first = await member.createRecipe(manualEntry(sampleButtermilkBiscuits));
		const second = await member.createRecipe(manualEntry(sampleButtermilkBiscuits));

		expect([first.slug, second.slug]).toEqual(['buttermilk-biscuits', 'buttermilk-biscuits-2']);
	});

	it('logs the creation', async () => {
		const author = memberActor();
		const member = createCatalog().serviceFor(author);

		const ref = await member.createRecipe({
			content: sampleChickenSoup,
			provenance: { entryMode: 'url', sourceUrl: 'https://example.com/soup' },
		});

		expect(consoleInfo).toHaveBeenCalledOnce();
		expect(JSON.parse(String(consoleInfo.mock.calls[0]?.[0]))).toEqual({
			level: 'info',
			logger: 'recipes',
			message: 'Recipe created',
			recipeId: ref.id,
			memberId: author.memberId,
			entryMode: 'url',
		});
	});
});

describe('updateRecipe', () => {
	it('refuses an anonymous visitor whether or not the recipe exists', async () => {
		const { serviceFor, ref } = await catalogWithBiscuits();
		const visitor = serviceFor(anonymousActor());

		await expect(visitor.updateRecipe(ref.id, sampleChickenSoup)).rejects.toThrow(
			SignInRequiredError
		);
		await expect(visitor.updateRecipe(missingId, sampleChickenSoup)).rejects.toThrow(
			SignInRequiredError
		);
	});

	it('refuses a member who is not the contributor, before validating the content', async () => {
		const { serviceFor, ref } = await catalogWithBiscuits();
		const other = serviceFor(memberActor());

		await expect(other.updateRecipe(ref.id, sampleChickenSoup)).rejects.toThrow(ForbiddenError);
		await expect(other.updateRecipe(ref.id, { ...sampleChickenSoup, title: ' ' })).rejects.toThrow(
			ForbiddenError
		);
		expect((await other.getRecipe(ref.slug))?.title).toBe('Buttermilk biscuits');
	});

	it.each(['contributor', 'admin'] as const)(
		'lets the %s replace the content and keeps the slug',
		async (editor) => {
			const { serviceFor, author, ref } = await catalogWithBiscuits();
			const service = serviceFor(editor === 'contributor' ? author : adminActor());

			expect(await service.updateRecipe(ref.id, sampleChickenSoup)).toEqual(ref);

			const recipe = await service.getRecipe('buttermilk-biscuits');
			expect(recipe).toMatchObject({ title: 'Weeknight chicken soup', source: 'Grandpa Lou' });
			expect(recipe?.description).toBeUndefined();
		}
	);

	it('respells a tag that only this recipe uses', async () => {
		const { serviceFor, author, ref } = await catalogWithBiscuits();
		const service = serviceFor(author);

		await service.updateRecipe(ref.id, {
			...sampleButtermilkBiscuits,
			tags: ['breakfast', 'Baking'],
		});

		expect((await service.getRecipe(ref.slug))?.tags).toEqual(['breakfast', 'Baking']);
	});

	it('keeps the label of a tag that another recipe also uses', async () => {
		const { serviceFor, author, ref } = await catalogWithBiscuits();
		const service = serviceFor(author);
		await service.createRecipe(manualEntry({ ...sampleChickenSoup, tags: ['Breakfast'] }));

		await service.updateRecipe(ref.id, {
			...sampleButtermilkBiscuits,
			tags: ['breakfast', 'Baking'],
		});

		expect((await service.getRecipe(ref.slug))?.tags).toEqual(['Breakfast', 'Baking']);
	});

	it.each([missingId, malformedId])('reports the id %s as not found', async (id) => {
		const admin = createCatalog().serviceFor(adminActor());

		await expect(admin.updateRecipe(id, sampleChickenSoup)).rejects.toThrow(RecipeNotFoundError);
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

		expect(await service.deleteRecipe(ref.id)).toEqual(ref);
		expect(await service.getRecipe(ref.slug)).toBeNull();
	});

	it.each([missingId, malformedId])('reports the id %s as not found', async (id) => {
		const admin = createCatalog().serviceFor(adminActor());

		await expect(admin.deleteRecipe(id)).rejects.toThrow(RecipeNotFoundError);
	});
});
