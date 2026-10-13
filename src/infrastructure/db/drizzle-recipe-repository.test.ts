import { eq, sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';
import type { NewMember } from '@/application/ports/member-repository';
import type { NewRecipe } from '@/application/ports/recipe-repository';
import { describeRecipeRepositoryContract } from '@/application/testing/recipe-repository-contract';
import { memberIdSchema, type MemberId } from '@/domain/member/member';
import {
	recipeContentSchema,
	type RecipeContentInput,
	type RecipeId,
} from '@/domain/recipe/recipe';
import {
	sampleButtermilkBiscuits,
	sampleChickenSoup,
	sampleLemonIceboxPie,
	sampleTomatoSalad,
} from '@/domain/recipe/samples/sample-recipes';
import { slugify } from '@/domain/recipe/slug';
import { DrizzleMemberRepository } from '@/infrastructure/db/drizzle-member-repository';
import { DrizzleRecipeImportRepository } from '@/infrastructure/db/drizzle-recipe-import-repository';
import { DrizzleRecipeRepository } from '@/infrastructure/db/drizzle-recipe-repository';
import { recipes } from '@/infrastructure/db/schema';
import { createTestDatabase, type TestDatabase } from '@/infrastructure/db/testing/test-database';

const contributor: NewMember = {
	email: 'contributor@example.com',
	displayName: 'Contributor',
	role: 'member',
};
const unknownMemberId = memberIdSchema.parse('3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b');
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
let contributorId: MemberId;

beforeEach(async () => {
	db = await createTestDatabase();
	repository = new DrizzleRecipeRepository(db);
	contributorId = (await new DrizzleMemberRepository(db).create(contributor)).id;
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

// Refuses any write of a slug made without an advisory lock held, as an unserialized one would be.
async function requireSlugLock() {
	await db.execute(
		sql.raw(`create function require_slug_lock() returns trigger language plpgsql as $$
begin
	if not exists (
		select 1 from pg_locks where locktype = 'advisory' and pid = pg_backend_pid() and granted
	) then
		raise exception 'slug written without the slug lock';
	end if;
	return new;
end
$$`)
	);
	await db.execute(
		sql`create trigger require_slug_lock before insert or update of slug on recipes for each row execute function require_slug_lock()`
	);
}

describeRecipeRepositoryContract(() => ({
	repository,
	imports: new DrizzleRecipeImportRepository(db),
	contributorId,
}));

describe('create', () => {
	it('assigns time-ordered uuidv7 ids', async () => {
		const first = await repository.create(newRecipe(sampleChickenSoup));
		const second = await repository.create(newRecipe(sampleTomatoSalad));

		expect(first.id).toMatch(uuidV7);
		expect(second.id > first.id).toBe(true);
	});

	it('refuses a contributor who is not a member', async () => {
		const recipe = newRecipe(sampleChickenSoup, { contributorId: unknownMemberId });

		await expect(repository.create(recipe)).rejects.toThrow(
			expect.objectContaining({
				cause: expect.objectContaining({ constraint: 'recipes_contributor_id_users_id_fk' }),
			})
		);
	});
});

describe('list', () => {
	it('orders recipes created at the same moment by id', async () => {
		const first = await repository.create(newRecipe(sampleChickenSoup));
		const second = await repository.create(newRecipe(sampleLemonIceboxPie));
		await backdate(first.id);
		await backdate(second.id);

		const listed = await repository.list({ limit: 10, offset: 0, sort: 'newest' });

		expect(listed.map(({ id }) => id)).toEqual([second.id, first.id]);
	});
});

describe('update', () => {
	it('moves updatedAt to the time of the save', async () => {
		const created = await repository.create(newRecipe(sampleChickenSoup));
		await backdate(created.id);

		const updated = await repository.update(created.id, {
			content: recipeContentSchema.parse(sampleTomatoSalad),
			expectedUpdatedAt: backdated,
		});

		// Now, not merely a millisecond past the stored version.
		expect(updated?.recipe.updatedAt.getTime()).toBeGreaterThan(backdated.getTime() + 1);
	});
});

describe('slug allocation', () => {
	it('holds the slug lock while a create or a rename writes a slug', async () => {
		const pie = await repository.create(newRecipe(sampleLemonIceboxPie));
		await requireSlugLock();

		const created = await repository.create(newRecipe(sampleButtermilkBiscuits));
		const renamed = await repository.update(pie.id, {
			content: recipeContentSchema.parse(sampleChickenSoup),
			expectedUpdatedAt: pie.updatedAt,
			slugBase: 'weeknight-chicken-soup',
		});

		expect(created.slug).toBe('buttermilk-biscuits');
		expect(renamed?.recipe.slug).toBe('weeknight-chicken-soup');
	});

	it('is checked here by a trigger that refuses a slug written without the lock', async () => {
		const pie = await repository.create(newRecipe(sampleLemonIceboxPie));
		await requireSlugLock();

		await expect(
			db.update(recipes).set({ slug: 'lemon-pie' }).where(eq(recipes.id, pie.id))
		).rejects.toThrow(
			expect.objectContaining({
				cause: expect.objectContaining({ message: 'slug written without the slug lock' }),
			})
		);
	});
});

describe('findTagLabels and findImagesInUse', () => {
	it('return nothing for nothing asked without querying', async () => {
		await repository.create(newRecipe(sampleChickenSoup));
		const query = vi.spyOn(db.$client, 'query');

		expect(await repository.findTagLabels([])).toEqual([]);
		expect(await repository.findImagesInUse([])).toEqual([]);
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
			.set({ content: sql`${recipes.content} - 'times'` })
			.where(eq(recipes.id, created.id));

		await expect(repository.findById(created.id)).rejects.toThrow(ZodError);
	});
});
