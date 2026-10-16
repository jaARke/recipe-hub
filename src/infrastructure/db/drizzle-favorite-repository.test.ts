import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { describeFavoriteRepositoryContract } from '@/application/testing/favorite-repository-contract';
import { memberIdSchema, type MemberId } from '@/domain/member/member';
import { recipeContentSchema, type RecipeId } from '@/domain/recipe/recipe';
import { sampleChickenSoup } from '@/domain/recipe/samples/sample-recipes';
import { DrizzleFavoriteRepository } from '@/infrastructure/db/drizzle-favorite-repository';
import { DrizzleMemberRepository } from '@/infrastructure/db/drizzle-member-repository';
import { DrizzleRecipeRepository } from '@/infrastructure/db/drizzle-recipe-repository';
import { favorites as favoritesTable } from '@/infrastructure/db/schema';
import { requireBoundedWrites } from '@/infrastructure/db/testing/bounded-writes';
import { createTestDatabase, type TestDatabase } from '@/infrastructure/db/testing/test-database';

const unknownMemberId = memberIdSchema.parse('3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b');

let db: TestDatabase;
let favorites: DrizzleFavoriteRepository;
let members: DrizzleMemberRepository;
let memberId: MemberId;
let otherMemberId: MemberId;

beforeEach(async () => {
	db = await createTestDatabase();
	favorites = new DrizzleFavoriteRepository(db);
	members = new DrizzleMemberRepository(db);
	memberId = (
		await members.create({ email: 'ada@example.com', displayName: 'Ada', role: 'member' })
	).id;
	otherMemberId = (
		await members.create({ email: 'lou@example.com', displayName: 'Lou', role: 'member' })
	).id;
});

afterEach(async () => {
	await db.$client.close();
});

async function createSoup(): Promise<RecipeId> {
	const recipe = await new DrizzleRecipeRepository(db).create({
		content: recipeContentSchema.parse(sampleChickenSoup),
		provenance: { entryMode: 'manual' },
		contributorId: otherMemberId,
		slugBase: 'weeknight-chicken-soup',
	});
	return recipe.id;
}

describeFavoriteRepositoryContract(() => ({
	favorites,
	recipes: new DrizzleRecipeRepository(db),
	memberId,
	otherMemberId,
}));

describe('add', () => {
	it('adds nothing for a member who was removed or never existed', async () => {
		const soupId = await createSoup();
		await members.remove(memberId);

		expect(await favorites.add(memberId, [soupId])).toBe(0);
		expect(await favorites.add(unknownMemberId, [soupId])).toBe(0);
		expect(await db.$count(favoritesTable)).toBe(0);
	});

	it("adds favorites in a bounded transaction, which bounds the wait for the member's row", async () => {
		const soupId = await createSoup();
		await requireBoundedWrites(db, 'favorites');

		expect(await favorites.add(memberId, [soupId])).toBe(1);
	});
});
