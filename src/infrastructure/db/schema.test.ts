import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NewMember } from '@/application/ports/member-repository';
import type { MemberId } from '@/domain/member/member';
import { totalMinutes, type RecipeTimes } from '@/domain/recipe/duration';
import { recipeContentSchema, type RecipeContentInput } from '@/domain/recipe/recipe';
import { sampleChickenSoup, sampleRecipeContents } from '@/domain/recipe/samples/sample-recipes';
import { slugify } from '@/domain/recipe/slug';
import { DrizzleMemberRepository } from '@/infrastructure/db/drizzle-member-repository';
import { DrizzleRecipeRepository } from '@/infrastructure/db/drizzle-recipe-repository';
import { recipes, recipeSearchConfiguration } from '@/infrastructure/db/schema';
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
		.select({ id: recipes.id, totalMinutes: recipes.totalMinutes })
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

describe('chapter, holidays and diets', () => {
	function refusedBy(constraint: string) {
		return expect.objectContaining({ cause: expect.objectContaining({ constraint }) });
	}

	it('refuse a slug outside the vocabulary', async () => {
		const { row } = await store(sampleChickenSoup);

		await expect(
			db.execute(sql`update recipes set chapter = 'supper' where id = ${row?.id}`)
		).rejects.toThrow(refusedBy('recipes_chapter_check'));
		await expect(
			db.execute(
				sql`update recipes set holidays = array['christmas', 'arbor-day'] where id = ${row?.id}`
			)
		).rejects.toThrow(refusedBy('recipes_holidays_check'));
		await expect(
			db.execute(sql`update recipes set diets = array['nut-free'] where id = ${row?.id}`)
		).rejects.toThrow(refusedBy('recipes_diets_check'));
	});

	it('give search the words of the holidays and diets, but not the chapter', async () => {
		// The soup's own text uses none of these words. The holidays and diets are at weight B, as are its
		// ingredient items.
		const matchesHolidayAndDietWords = sql<boolean>`${recipes.searchVector} @@ to_tsquery(${recipeSearchConfiguration}, 'new:B & years:B & day:B & gluten:B & free:B')`;
		const matchesChapterWords = sql<boolean>`${recipes.searchVector} @@ to_tsquery(${recipeSearchConfiguration}, 'main | dishes')`;
		const { row } = await store({
			...sampleChickenSoup,
			chapter: 'main-dishes',
			holidays: ['new-years-day'],
			diets: ['gluten-free'],
		});
		const [columns] = await db
			.select({
				matchesHolidayAndDietWords,
				matchesChapterWords,
				searchWords: recipes.searchWords,
			})
			.from(recipes)
			.where(eq(recipes.id, row!.id));

		expect(columns).toEqual({
			matchesHolidayAndDietWords: true,
			matchesChapterWords: false,
			// The holidays and diets follow the ingredient items' array directly.
			searchWords: expect.stringMatching(/"\] new-years-day gluten-free$/),
		});
	});
});
