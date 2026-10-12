import { describe, expect, it } from 'vitest';
import type {
	NewRecipe,
	RecipeRepository,
	RecipeUpdate,
	UpdatedRecipe,
} from '@/application/ports/recipe-repository';
import { RecipeEditConflictError } from '@/application/recipes/errors';
import type { MemberId } from '@/domain/member/member';
import type { Provenance } from '@/domain/recipe/provenance';
import {
	recipeContentSchema,
	recipeIdSchema,
	type Recipe,
	type RecipeContentInput,
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
import { tagKey } from '@/domain/recipe/tag';

export type RecipeRepositoryFixture = {
	repository: RecipeRepository;
	// A member the repository accepts as a contributor.
	contributorId: MemberId;
};

const missingId = recipeIdSchema.parse('0199c7a4-2c3e-7b1a-9f00-2a7c1e4b5d6e');

// A title whose 60-character slug loses its last word to fit a candidate's suffix, and a title whose
// slug is that truncated second candidate.
const truncatedStem = 'a'.repeat(50);
const longTitle = `${truncatedStem} ${'b'.repeat(9)}`;
const truncatedSecondTitle = `${truncatedStem} 2`;

// What every RecipeRepository guarantees. The caller provides a fresh, empty fixture for each test.
export function describeRecipeRepositoryContract(fixture: () => RecipeRepositoryFixture): void {
	function newRecipe(input: RecipeContentInput, overrides: Partial<NewRecipe> = {}): NewRecipe {
		const content = recipeContentSchema.parse(input);
		return {
			content,
			provenance: { entryMode: 'manual' },
			contributorId: fixture().contributorId,
			slugBase: slugify(content.title),
			...overrides,
		};
	}

	function create(input: RecipeContentInput, overrides?: Partial<NewRecipe>): Promise<Recipe> {
		return fixture().repository.create(newRecipe(input, overrides));
	}

	// Saves from the recipe's current version, as an edit loaded just now would.
	async function save(
		recipe: Recipe,
		changes: Omit<RecipeUpdate, 'expectedUpdatedAt'>
	): Promise<UpdatedRecipe | null> {
		const { repository } = fixture();
		const current = await repository.findById(recipe.id);
		if (current === null) {
			throw new Error('No recipe has this id');
		}

		return repository.update(recipe.id, { ...changes, expectedUpdatedAt: current.updatedAt });
	}

	// An edit that retitles the recipe, which moves its slug to the new title's.
	async function retitle(recipe: Recipe, input: RecipeContentInput): Promise<Recipe | undefined> {
		const content = recipeContentSchema.parse(input);
		return (await save(recipe, { content, slugBase: slugify(content.title) }))?.recipe;
	}

	describe('create', () => {
		// One test for every sample, so the samples share one store.
		it('stores each sample and reads it back unchanged', async () => {
			const { repository, contributorId } = fixture();
			for (const input of sampleRecipeContents) {
				const recipe = newRecipe(input);
				const created = await repository.create(recipe);

				expect(created, input.title).toEqual({
					...recipe.content,
					id: expect.any(String),
					slug: recipe.slugBase,
					contributorId,
					provenance: recipe.provenance,
					createdAt: expect.any(Date),
					updatedAt: created.createdAt,
				});
				expect(await repository.findById(created.id), input.title).toEqual(created);
			}
		});

		it('keeps ranges, images, and the provenance of an import', async () => {
			const provenance: Provenance = {
				entryMode: 'url',
				sourceUrl: 'https://example.com/chicken-soup',
				aiModel: 'example/model',
			};
			const recipe = newRecipe(
				{
					...sampleChickenSoup,
					images: [
						{ role: 'dish', pathname: 'dish/soup.jpg', alt: 'A bowl of chicken soup' },
						{ role: 'scan', pathname: 'scan/soup-card.jpg' },
					],
				},
				{ provenance }
			);
			const { repository } = fixture();

			const found = await repository.findById((await repository.create(recipe)).id);

			expect(found).toMatchObject({ ...recipe.content, provenance });
			expect(found?.ingredientSections[0]?.lines[2]?.amount).toEqual({ min: 2, max: 3 });
		});

		it('numbers the slug when the title is taken', async () => {
			const slugs = [];
			for (let count = 0; count < 3; count += 1) {
				slugs.push((await create(sampleButtermilkBiscuits)).slug);
			}

			expect(slugs).toEqual([
				'buttermilk-biscuits',
				'buttermilk-biscuits-2',
				'buttermilk-biscuits-3',
			]);
		});

		it("never takes another recipe's old slug", async () => {
			await retitle(await create(sampleButtermilkBiscuits), sampleChickenSoup);

			expect((await create(sampleButtermilkBiscuits)).slug).toBe('buttermilk-biscuits-2');
		});

		it("never takes another recipe's old slug as a truncated candidate", async () => {
			await retitle(
				await create({ ...sampleChickenSoup, title: truncatedSecondTitle }),
				sampleTomatoSalad
			);
			await create({ ...sampleChickenSoup, title: longTitle });

			const created = await create({ ...sampleChickenSoup, title: longTitle });

			expect(created.slug).toBe(`${truncatedStem}-3`);
			expect(await fixture().repository.findBySlug(`${truncatedStem}-2`)).toMatchObject({
				title: 'Garden tomato salad',
			});
		});
	});

	describe('findById and findBySlug', () => {
		it('find a stored recipe', async () => {
			const created = await create(sampleLemonIceboxPie);
			const { repository } = fixture();

			expect(await repository.findById(created.id)).toEqual(created);
			expect(await repository.findBySlug('lemon-icebox-pie-with-a-graham-cracker-crust')).toEqual(
				created
			);
		});

		it('return null when nothing matches', async () => {
			await create(sampleLemonIceboxPie);
			const { repository } = fixture();

			expect(await repository.findById(missingId)).toBeNull();
			expect(await repository.findBySlug('lemon-icebox-pie')).toBeNull();
		});

		it('findBySlug finds a retitled recipe by its old slug, with its current slug', async () => {
			const retitled = await retitle(await create(sampleButtermilkBiscuits), sampleChickenSoup);

			const found = await fixture().repository.findBySlug('buttermilk-biscuits');

			expect(found).toEqual(retitled);
			expect(found?.slug).toBe('weeknight-chicken-soup');
		});
	});

	describe('list', () => {
		it('pages through recipes newest first', async () => {
			const created = [];
			for (const content of sampleRecipeContents.slice(0, 3)) {
				created.push(await create(content));
			}
			const [first, second, third] = created;
			const { repository } = fixture();

			expect(await repository.list({ limit: 2, offset: 0, sort: 'newest' })).toEqual([
				third,
				second,
			]);
			expect(await repository.list({ limit: 2, offset: 2, sort: 'newest' })).toEqual([first]);
		});

		it('pages through recipes by title, ignoring accents and case, and then by id', async () => {
			const titles = [
				'zucchini bread',
				'Éclairs',
				'Apple crisp',
				'Eclair filling',
				'apple crisp',
				'Eggplant parmesan',
				'dumplings',
			];
			const created = [];
			for (const title of titles) {
				created.push(await create({ ...sampleChickenSoup, title }));
			}
			// The two spellings of "apple crisp" tie, so their ids order them.
			const applesById = created
				.filter(({ title }) => title.toLowerCase() === 'apple crisp')
				.toSorted((a, b) => (a.id < b.id ? -1 : 1))
				.map(({ title }) => title);
			const { repository } = fixture();

			const firstPage = await repository.list({ limit: 4, offset: 0, sort: 'title' });
			const secondPage = await repository.list({ limit: 4, offset: 4, sort: 'title' });

			expect([...firstPage, ...secondPage].map(({ title }) => title)).toEqual([
				...applesById,
				'dumplings',
				'Eclair filling',
				'Éclairs',
				'Eggplant parmesan',
				'zucchini bread',
			]);
		});
	});

	describe('count', () => {
		it('counts every recipe', async () => {
			const { repository } = fixture();
			expect(await repository.count()).toBe(0);

			for (const content of sampleRecipeContents.slice(0, 3)) {
				await create(content);
			}

			expect(await repository.count()).toBe(3);
		});
	});

	describe('update', () => {
		it('replaces the content and tags, and keeps the slug, provenance, and creation time', async () => {
			const provenance: Provenance = { entryMode: 'photo', aiModel: 'example/model' };
			const created = await create(sampleButtermilkBiscuits, { provenance });
			// The new content has no description, so a merged document would show the old one.
			const content = recipeContentSchema.parse({
				...sampleChickenSoup,
				tags: ['Soup', 'Make ahead'],
			});
			const { repository, contributorId } = fixture();

			const updated = await repository.update(created.id, {
				content,
				expectedUpdatedAt: created.updatedAt,
			});

			expect(updated).toEqual({
				recipe: {
					...content,
					id: created.id,
					slug: 'buttermilk-biscuits',
					contributorId,
					provenance,
					createdAt: created.createdAt,
					updatedAt: expect.any(Date),
				},
				previousSlug: 'buttermilk-biscuits',
			});
			expect(updated?.recipe.description).toBeUndefined();
			expect(updated?.recipe.updatedAt.getTime()).toBeGreaterThan(created.updatedAt.getTime());
			expect(await repository.findById(created.id)).toEqual(updated?.recipe);
		});

		it('moves the slug to the new base, reports the one it replaced, and keeps that finding the recipe', async () => {
			const created = await create(sampleButtermilkBiscuits);
			const content = recipeContentSchema.parse(sampleChickenSoup);

			const updated = await save(created, { content, slugBase: 'weeknight-chicken-soup' });

			expect(updated).toMatchObject({
				recipe: { id: created.id, slug: 'weeknight-chicken-soup' },
				previousSlug: 'buttermilk-biscuits',
			});
			const { repository } = fixture();
			expect(await repository.findBySlug('weeknight-chicken-soup')).toEqual(updated?.recipe);
			expect(await repository.findBySlug('buttermilk-biscuits')).toEqual(updated?.recipe);
		});

		it('numbers the new slug past the slugs other recipes hold, current or old', async () => {
			await create(sampleButtermilkBiscuits);
			await retitle(await create(sampleChickenSoup), sampleTomatoSalad);
			const pie = await create(sampleLemonIceboxPie);

			const toBiscuits = await retitle(pie, sampleButtermilkBiscuits);
			const toSoup = await retitle(pie, sampleChickenSoup);

			expect(toBiscuits?.slug).toBe('buttermilk-biscuits-2');
			expect(toSoup?.slug).toBe('weeknight-chicken-soup-2');
		});

		it("numbers the new slug past another recipe's old slug as a truncated candidate", async () => {
			await retitle(
				await create({ ...sampleChickenSoup, title: truncatedSecondTitle }),
				sampleTomatoSalad
			);
			await create({ ...sampleChickenSoup, title: longTitle });
			const pie = await create(sampleLemonIceboxPie);

			const retitled = await retitle(pie, { ...sampleChickenSoup, title: longTitle });

			expect(retitled?.slug).toBe(`${truncatedStem}-3`);
		});

		it("takes back the recipe's own old slug when retitled back", async () => {
			const created = await create(sampleButtermilkBiscuits);
			await retitle(created, sampleChickenSoup);

			const restored = await retitle(created, sampleButtermilkBiscuits);

			expect(restored?.slug).toBe('buttermilk-biscuits');
			expect(await fixture().repository.findBySlug('weeknight-chicken-soup')).toEqual(restored);
		});

		it('keeps the slug when the first free candidate is the current one', async () => {
			await create(sampleButtermilkBiscuits);
			const second = await create(sampleButtermilkBiscuits);
			const content = recipeContentSchema.parse(sampleButtermilkBiscuits);

			const updated = await save(second, { content, slugBase: 'buttermilk-biscuits' });

			expect(updated).toMatchObject({
				recipe: { slug: 'buttermilk-biscuits-2' },
				previousSlug: 'buttermilk-biscuits-2',
			});
		});

		it('refuses a version saved over since, and changes nothing', async () => {
			const created = await create(sampleButtermilkBiscuits);
			const { repository } = fixture();
			// Saved right away, so the next save names a version less than a millisecond old.
			const first = await repository.update(created.id, {
				content: recipeContentSchema.parse({ ...sampleButtermilkBiscuits, notes: 'First edit.' }),
				expectedUpdatedAt: created.updatedAt,
			});

			await expect(
				repository.update(created.id, {
					content: recipeContentSchema.parse(sampleChickenSoup),
					expectedUpdatedAt: created.updatedAt,
					slugBase: 'weeknight-chicken-soup',
				})
			).rejects.toThrow(RecipeEditConflictError);
			expect(await repository.findById(created.id)).toEqual(first?.recipe);
			expect(await repository.findBySlug('weeknight-chicken-soup')).toBeNull();
		});

		it('returns null when no recipe has the id', async () => {
			const content = recipeContentSchema.parse(sampleChickenSoup);
			const expectedUpdatedAt = new Date();
			const { repository } = fixture();

			expect(await repository.update(missingId, { content, expectedUpdatedAt })).toBeNull();
			expect(
				await repository.update(missingId, {
					content,
					expectedUpdatedAt,
					slugBase: 'weeknight-chicken-soup',
				})
			).toBeNull();
		});
	});

	describe('delete', () => {
		it('removes the recipe and returns it as it was, or null when none was there', async () => {
			const created = await create(sampleChickenSoup);
			const { repository } = fixture();

			expect(await repository.delete(created.id)).toEqual(created);
			expect(await repository.findById(created.id)).toBeNull();
			expect(await repository.delete(created.id)).toBeNull();
		});

		it('returns the slug and images the recipe had when deleted, after an edit since it was read', async () => {
			const created = await create({ ...sampleChickenSoup, images: [] });
			const photo: RecipeImage = { role: 'dish', pathname: 'dish/salad.jpg' };
			const retitled = await retitle(created, { ...sampleTomatoSalad, images: [photo] });

			const deleted = await fixture().repository.delete(created.id);

			expect(deleted).toEqual(retitled);
			expect(deleted).toMatchObject({ slug: 'garden-tomato-salad', images: [photo] });
		});

		it('frees the old slugs of the recipe', async () => {
			const created = await create(sampleButtermilkBiscuits);
			await retitle(created, sampleChickenSoup);
			const { repository } = fixture();

			await repository.delete(created.id);

			expect(await repository.findBySlug('buttermilk-biscuits')).toBeNull();
			expect((await create(sampleButtermilkBiscuits)).slug).toBe('buttermilk-biscuits');
		});
	});

	describe('findTagLabels', () => {
		it('finds labels in use whose key matches, across case and spacing', async () => {
			await create(sampleChickenSoup);
			await create(sampleLemonIceboxPie);
			const keys = [' make  AHEAD', 'SOUP', 'Breakfast'].map(tagKey);

			const labels = await fixture().repository.findTagLabels(keys);

			expect(labels.toSorted()).toEqual(['Make ahead', 'Soup']);
		});

		it('ignores the excluded recipe, so its own spellings can change', async () => {
			const pie = await create(sampleLemonIceboxPie);
			await create({ ...sampleChickenSoup, tags: ['make  AHEAD'] });
			const keys = ['Dessert', 'Make ahead'].map(tagKey);

			const labels = await fixture().repository.findTagLabels(keys, pie.id);

			expect(labels).toEqual(['make AHEAD']);
		});
	});

	describe('findImagesInUse', () => {
		const soupPhoto: RecipeImage = { role: 'dish', pathname: 'dish/soup.jpg' };
		const sharedPhoto: RecipeImage = { role: 'dish', pathname: 'dish/shared.jpg' };
		const saladScan: RecipeImage = { role: 'scan', pathname: 'scan/salad-card.jpg' };

		it('finds the given pathnames that some recipe lists, under either role', async () => {
			await create({ ...sampleChickenSoup, images: [soupPhoto, sharedPhoto] });
			await create({ ...sampleTomatoSalad, images: [sharedPhoto, saladScan] });

			const inUse = await fixture().repository.findImagesInUse([
				soupPhoto.pathname,
				saladScan.pathname,
				'dish/unlisted.jpg',
			]);

			expect(inUse.toSorted()).toEqual([soupPhoto.pathname, saladScan.pathname]);
		});

		it('stops finding a pathname once no recipe lists it', async () => {
			const soup = await create({ ...sampleChickenSoup, images: [soupPhoto, sharedPhoto] });
			const salad = await create({ ...sampleTomatoSalad, images: [sharedPhoto] });
			const { repository } = fixture();

			await save(soup, {
				content: recipeContentSchema.parse({ ...sampleChickenSoup, images: [sharedPhoto] }),
			});
			expect(await repository.findImagesInUse([soupPhoto.pathname, sharedPhoto.pathname])).toEqual([
				sharedPhoto.pathname,
			]);

			await repository.delete(soup.id);
			await repository.delete(salad.id);
			expect(await repository.findImagesInUse([sharedPhoto.pathname])).toEqual([]);
		});

		it('finds nothing for no pathnames', async () => {
			await create({ ...sampleChickenSoup, images: [soupPhoto] });

			expect(await fixture().repository.findImagesInUse([])).toEqual([]);
		});
	});
}
