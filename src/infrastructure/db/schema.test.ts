import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NewMember } from '@/application/ports/member-repository';
import type { MemberId } from '@/domain/member/member';
import { totalMinutes, type RecipeTimes } from '@/domain/recipe/duration';
import { recipeContentSchema, type RecipeContentInput } from '@/domain/recipe/recipe';
import { sampleChickenSoup, sampleRecipeContents } from '@/domain/recipe/samples/sample-recipes';
import { slugify } from '@/domain/recipe/slug';
import { tagKey } from '@/domain/recipe/tag-normalization';
import { DrizzleMemberRepository } from '@/infrastructure/db/drizzle-member-repository';
import { DrizzleRecipeRepository } from '@/infrastructure/db/drizzle-recipe-repository';
import { recipes } from '@/infrastructure/db/schema';
import { createTestDatabase, type TestDatabase } from '@/infrastructure/db/testing/test-database';

const contributor: NewMember = {
	email: 'contributor@example.com',
	displayName: 'Contributor',
	role: 'member',
};

// Each test reads back only the row it stored, so the tests share one database.
let db: TestDatabase;
let repository: DrizzleRecipeRepository;
let contributorId: MemberId;

beforeAll(async () => {
	db = await createTestDatabase();
	repository = new DrizzleRecipeRepository(db);
	contributorId = (await new DrizzleMemberRepository(db).create(contributor)).id;
});

afterAll(async () => {
	await db.$client.close();
});

async function store(input: RecipeContentInput) {
	const content = recipeContentSchema.parse(input);
	const created = await repository.create({
		content,
		provenance: { entryMode: 'manual' },
		contributorId,
		slugBase: slugify(content.title),
	});
	const [row] = await db
		.select({ totalMinutes: recipes.totalMinutes, tagKeys: recipes.tagKeys })
		.from(recipes)
		.where(eq(recipes.id, created.id));
	return { content, row };
}

describe('total_minutes', () => {
	const edgeCases: [string, RecipeTimes][] = [
		['no times', {}],
		['cook only', { cookMinutes: 40 }],
		['prep of zero', { prepMinutes: 0 }],
		['prep and cook', { prepMinutes: 10, cookMinutes: 20 }],
		['a stated total of zero', { totalMinutes: 0, prepMinutes: 10, cookMinutes: 5 }],
		['a total past 32-bit integers', { totalMinutes: 2_147_483_648 }],
		['prep and cook past 32-bit integers', { prepMinutes: 2_147_483_647, cookMinutes: 1 }],
	];

	it.each([
		...sampleRecipeContents.map((sample): [string, RecipeContentInput] => [sample.title, sample]),
		...edgeCases.map(([name, times]): [string, RecipeContentInput] => [
			name,
			{ ...sampleChickenSoup, times },
		]),
	])('agrees with totalMinutes for %s', async (_name, input) => {
		const { content, row } = await store(input);

		expect(row?.totalMinutes).toBe(totalMinutes(content.times) ?? null);
	});
});

describe('tag_keys', () => {
	it.each([
		'İSTANBUL',
		'ΟΔΟΣ',
		'Crème brûlée',
		'Cre\u0301me',
		'Straße',
		'ẞ',
		'\u212A',
		'  Make   AHEAD ',
	])('agrees with tagKey for %j', async (label) => {
		const { content, row } = await store({ ...sampleChickenSoup, tags: [label] });

		expect(row?.tagKeys).toEqual(content.tags.map(tagKey));
	});
});
