import { eq, sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';
import type { NewRecipe } from '@/application/ports/recipe-repository';
import { memberIdSchema } from '@/domain/member/member';
import type { Provenance } from '@/domain/recipe/provenance';
import {
	recipeContentSchema,
	recipeIdSchema,
	type RecipeContentInput,
	type RecipeId,
} from '@/domain/recipe/recipe';
import { slugCandidate, slugify } from '@/domain/recipe/slug';
import { tagKey } from '@/domain/recipe/tag';
import {
	sampleButtermilkBiscuits,
	sampleChickenSoup,
	sampleLemonIceboxPie,
	sampleRecipeContents,
	sampleTomatoSalad,
} from '@/domain/recipe/testing/sample-recipes';
import { DrizzleRecipeRepository } from '@/infrastructure/db/drizzle-recipe-repository';
import { recipes } from '@/infrastructure/db/schema';
import { createTestDatabase, type TestDatabase } from '@/infrastructure/db/testing/test-database';

const contributorId = memberIdSchema.parse('3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b');
const missingId = recipeIdSchema.parse('0199c7a4-2c3e-7b1a-9f00-2a7c1e4b5d6e');
const backdated = new Date('2026-01-01T00:00:00Z');

const uuidV7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function newRecipe(input: RecipeContentInput, overrides: Partial<NewRecipe> = {}): NewRecipe {
	const content = recipeContentSchema.parse(input);
	return {
		content,
		provenance: { entryMode: 'manual' },
		contributorId,
		slugBase: slugify(content.title),
		...overrides,
	};
}

let db: TestDatabase;
let repository: DrizzleRecipeRepository;

beforeEach(async () => {
	db = await createTestDatabase();
	repository = new DrizzleRecipeRepository(db);
});

afterEach(async () => {
	await db.$client.close();
});

async function backdate(id: RecipeId) {
	await db
		.update(recipes)
		.set({ createdAt: backdated, updatedAt: backdated })
		.where(eq(recipes.id, id));
}

describe('create', () => {
	it.each(sampleRecipeContents.map((content) => [content.title, content]))(
		'stores the sample "%s" and reads it back unchanged',
		async (_title, input) => {
			const recipe = newRecipe(input);
			const created = await repository.create(recipe);

			expect(created).toEqual({
				...recipe.content,
				id: expect.stringMatching(uuidV7),
				slug: recipe.slugBase,
				contributorId,
				provenance: recipe.provenance,
				createdAt: expect.any(Date),
				updatedAt: created.createdAt,
			});
			expect(await repository.findById(created.id)).toEqual(created);
		}
	);

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
					{ role: 'dish', pathname: 'recipes/soup.jpg', alt: 'A bowl of chicken soup' },
					{ role: 'scan', pathname: 'scans/soup-card.jpg' },
				],
			},
			{ provenance }
		);

		const found = await repository.findById((await repository.create(recipe)).id);

		expect(found).toMatchObject({ ...recipe.content, provenance });
		expect(found?.ingredientSections[0]?.lines[2]?.amount).toEqual({ min: 2, max: 3 });
	});

	it('assigns time-ordered uuidv7 ids', async () => {
		const first = await repository.create(newRecipe(sampleChickenSoup));
		const second = await repository.create(newRecipe(sampleTomatoSalad));

		expect(first.id).toMatch(uuidV7);
		expect(second.id > first.id).toBe(true);
	});

	it('numbers the slug when the title is taken', async () => {
		const slugs = [];
		for (let count = 0; count < 3; count += 1) {
			slugs.push((await repository.create(newRecipe(sampleButtermilkBiscuits))).slug);
		}

		expect(slugs).toEqual([
			'buttermilk-biscuits',
			'buttermilk-biscuits-2',
			'buttermilk-biscuits-3',
		]);
	});

	it('moves on when the insert finds a candidate the lookup missed', async () => {
		// Truncated to fit the suffix, this base's second candidate falls outside the lookup.
		const slugBase = `${'a'.repeat(50)}-${'b'.repeat(8)}`;
		await repository.create(newRecipe(sampleChickenSoup, { slugBase }));
		await repository.create(newRecipe(sampleChickenSoup, { slugBase: slugCandidate(slugBase, 2) }));

		const created = await repository.create(newRecipe(sampleChickenSoup, { slugBase }));

		expect(created.slug).toBe(slugCandidate(slugBase, 3));
	});
});

describe('findById and findBySlug', () => {
	it('find a stored recipe', async () => {
		const created = await repository.create(newRecipe(sampleLemonIceboxPie));

		expect(await repository.findById(created.id)).toEqual(created);
		expect(await repository.findBySlug('lemon-icebox-pie-with-a-graham-cracker-crust')).toEqual(
			created
		);
	});

	it('return null when nothing matches', async () => {
		await repository.create(newRecipe(sampleLemonIceboxPie));

		expect(await repository.findById(missingId)).toBeNull();
		expect(await repository.findBySlug('lemon-icebox-pie')).toBeNull();
	});
});

describe('list', () => {
	it('pages through recipes newest first', async () => {
		const created = [];
		for (const content of sampleRecipeContents.slice(0, 3)) {
			created.push(await repository.create(newRecipe(content)));
		}
		const [first, second, third] = created;

		expect(await repository.list({ limit: 2, offset: 0 })).toEqual([third, second]);
		expect(await repository.list({ limit: 2, offset: 2 })).toEqual([first]);
	});

	it('orders recipes created at the same moment by id', async () => {
		const first = await repository.create(newRecipe(sampleChickenSoup));
		const second = await repository.create(newRecipe(sampleLemonIceboxPie));
		await backdate(first.id);
		await backdate(second.id);

		const listed = await repository.list({ limit: 10, offset: 0 });

		expect(listed.map(({ id }) => id)).toEqual([second.id, first.id]);
	});
});

describe('update', () => {
	it('replaces the content and tags, keeps the slug, and moves updatedAt', async () => {
		const created = await repository.create(newRecipe(sampleButtermilkBiscuits));
		await backdate(created.id);
		// The new content has no description, so a merged document would show the old one.
		const content = recipeContentSchema.parse({
			...sampleChickenSoup,
			tags: ['Soup', 'Make ahead'],
		});

		const updated = await repository.update(created.id, content);

		expect(updated).toEqual({
			...content,
			id: created.id,
			slug: 'buttermilk-biscuits',
			contributorId,
			provenance: created.provenance,
			createdAt: backdated,
			updatedAt: expect.any(Date),
		});
		expect(updated?.description).toBeUndefined();
		expect(updated?.updatedAt.getTime()).toBeGreaterThan(backdated.getTime());
		expect(await repository.findById(created.id)).toEqual(updated);
	});

	it('keeps the provenance unchanged', async () => {
		const provenance: Provenance = { entryMode: 'photo', aiModel: 'example/model' };
		const created = await repository.create(newRecipe(sampleButtermilkBiscuits, { provenance }));

		const updated = await repository.update(
			created.id,
			recipeContentSchema.parse(sampleChickenSoup)
		);

		expect(updated?.provenance).toEqual(provenance);
		expect((await repository.findById(created.id))?.provenance).toEqual(provenance);
	});

	it('returns null when no recipe has the id', async () => {
		const content = recipeContentSchema.parse(sampleChickenSoup);

		expect(await repository.update(missingId, content)).toBeNull();
	});
});

describe('delete', () => {
	it('removes the recipe and reports whether one was there', async () => {
		const created = await repository.create(newRecipe(sampleChickenSoup));

		expect(await repository.delete(created.id)).toBe(true);
		expect(await repository.findById(created.id)).toBeNull();
		expect(await repository.delete(created.id)).toBe(false);
	});
});

describe('findTagLabels', () => {
	it('finds labels in use whose key matches, across case and spacing', async () => {
		await repository.create(newRecipe(sampleChickenSoup));
		await repository.create(newRecipe(sampleLemonIceboxPie));
		const keys = [' make  AHEAD', 'SOUP', 'Breakfast'].map(tagKey);

		const labels = await repository.findTagLabels(keys);

		expect(labels.toSorted()).toEqual(['Make ahead', 'Soup']);
	});

	it('ignores the excluded recipe, so its own spellings can change', async () => {
		const pie = await repository.create(newRecipe(sampleLemonIceboxPie));
		await repository.create(
			newRecipe(sampleChickenSoup, {
				content: recipeContentSchema.parse({ ...sampleChickenSoup, tags: ['make  AHEAD'] }),
			})
		);
		const keys = ['Dessert', 'Make ahead'].map(tagKey);

		const labels = await repository.findTagLabels(keys, pie.id);

		expect(labels).toEqual(['make AHEAD']);
	});

	it('returns nothing for no keys without querying', async () => {
		await repository.create(newRecipe(sampleChickenSoup));
		const query = vi.spyOn(db.$client, 'query');

		expect(await repository.findTagLabels([])).toEqual([]);
		expect(query).not.toHaveBeenCalled();
	});
});

describe('reading stored documents', () => {
	it('drops keys the schema does not know', async () => {
		const created = await repository.create(newRecipe(sampleChickenSoup));
		await db
			.update(recipes)
			.set({ content: sql`${recipes.content} || '{"retiredField": true}'::jsonb` })
			.where(eq(recipes.id, created.id));

		expect(await repository.findById(created.id)).toEqual(created);
	});

	it('throws when a required field is missing', async () => {
		const created = await repository.create(newRecipe(sampleChickenSoup));
		await db
			.update(recipes)
			.set({ content: sql`${recipes.content} - 'title'` })
			.where(eq(recipes.id, created.id));

		await expect(repository.findById(created.id)).rejects.toThrow(ZodError);
	});
});
