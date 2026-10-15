import { describe, expect, it } from 'vitest';
import type { FavoriteRepository } from '@/application/ports/favorite-repository';
import type { RecipeRepository } from '@/application/ports/recipe-repository';
import type { MemberId } from '@/domain/member/member';
import {
	recipeContentSchema,
	recipeIdSchema,
	type Recipe,
	type RecipeContentInput,
} from '@/domain/recipe/recipe';
import {
	sampleButtermilkBiscuits,
	sampleChickenSoup,
	sampleLemonIceboxPie,
	sampleTomatoSalad,
} from '@/domain/recipe/samples/sample-recipes';
import { slugify } from '@/domain/recipe/slug';

export type FavoriteRepositoryFixture = {
	favorites: FavoriteRepository;
	// Where the recipes favorites name are stored.
	recipes: RecipeRepository;
	// Two members the repositories accept.
	memberId: MemberId;
	otherMemberId: MemberId;
};

const missingId = recipeIdSchema.parse('0199c7a4-2c3e-7b1a-9f00-2a7c1e4b5d6e');

const everything = { limit: 100, offset: 0 };

// What every FavoriteRepository guarantees. The caller provides a fresh, empty fixture for each test.
export function describeFavoriteRepositoryContract(fixture: () => FavoriteRepositoryFixture): void {
	function create(input: RecipeContentInput): Promise<Recipe> {
		const { recipes, memberId } = fixture();
		const content = recipeContentSchema.parse(input);
		return recipes.create({
			content,
			provenance: { entryMode: 'manual' },
			contributorId: memberId,
			slugBase: slugify(content.title),
		});
	}

	// The soup, the pie, and the salad, created in that order.
	async function createRecipes(): Promise<[Recipe, Recipe, Recipe]> {
		const soup = await create(sampleChickenSoup);
		const pie = await create(sampleLemonIceboxPie);
		const salad = await create(sampleTomatoSalad);
		return [soup, pie, salad];
	}

	describe('add and list', () => {
		it('list favorites newest first, each added on its own', async () => {
			const { favorites, memberId } = fixture();
			const [soup, pie, salad] = await createRecipes();

			for (const recipe of [soup, pie, salad]) {
				expect(await favorites.add(memberId, [recipe.id])).toBe(1);
			}

			expect(await favorites.list(memberId, everything)).toEqual([salad, pie, soup]);
		});

		it('list the first of several added at once as the newest', async () => {
			const { favorites, memberId } = fixture();
			const [soup, pie, salad] = await createRecipes();
			const biscuits = await create(sampleButtermilkBiscuits);
			await favorites.add(memberId, [biscuits.id]);

			expect(await favorites.add(memberId, [pie.id, soup.id, salad.id])).toBe(3);

			expect(await favorites.list(memberId, everything)).toEqual([pie, soup, salad, biscuits]);
		});

		it('skip favorites already added, which keep their place, and ids no recipe has', async () => {
			const { favorites, memberId } = fixture();
			const [soup, pie] = await createRecipes();
			await favorites.add(memberId, [soup.id]);

			expect(await favorites.add(memberId, [pie.id, missingId, soup.id, pie.id])).toBe(1);

			expect(await favorites.list(memberId, everything)).toEqual([pie, soup]);
		});

		it('add nothing for no ids', async () => {
			const { favorites, memberId } = fixture();
			await createRecipes();

			expect(await favorites.add(memberId, [])).toBe(0);
			expect(await favorites.list(memberId, everything)).toEqual([]);
		});

		it('page through the favorites', async () => {
			const { favorites, memberId } = fixture();
			const [soup, pie, salad] = await createRecipes();
			await favorites.add(memberId, [salad.id, pie.id, soup.id]);

			expect(await favorites.list(memberId, { limit: 2, offset: 0 })).toEqual([salad, pie]);
			expect(await favorites.list(memberId, { limit: 2, offset: 2 })).toEqual([soup]);
			expect(await favorites.list(memberId, { limit: 2, offset: 4 })).toEqual([]);
		});

		it("keep each member's favorites their own", async () => {
			const { favorites, memberId, otherMemberId } = fixture();
			const [soup, pie] = await createRecipes();
			await favorites.add(memberId, [soup.id]);

			expect(await favorites.add(otherMemberId, [pie.id, soup.id])).toBe(2);

			expect(await favorites.list(memberId, everything)).toEqual([soup]);
			expect(await favorites.list(otherMemberId, everything)).toEqual([pie, soup]);
		});
	});

	describe('remove', () => {
		it('removes the one favorite, leaving the rest and other members', async () => {
			const { favorites, memberId, otherMemberId } = fixture();
			const [soup, pie] = await createRecipes();
			await favorites.add(memberId, [pie.id, soup.id]);
			await favorites.add(otherMemberId, [soup.id]);

			await favorites.remove(memberId, soup.id);

			expect(await favorites.list(memberId, everything)).toEqual([pie]);
			expect(await favorites.list(otherMemberId, everything)).toEqual([soup]);
		});

		it('changes nothing for a recipe that is not a favorite', async () => {
			const { favorites, memberId } = fixture();
			const [soup, pie] = await createRecipes();
			await favorites.add(memberId, [soup.id]);

			await favorites.remove(memberId, pie.id);
			await favorites.remove(memberId, missingId);

			expect(await favorites.list(memberId, everything)).toEqual([soup]);
		});

		it('lets the recipe be added again, as the newest', async () => {
			const { favorites, memberId } = fixture();
			const [soup, pie] = await createRecipes();
			await favorites.add(memberId, [pie.id, soup.id]);

			await favorites.remove(memberId, soup.id);

			expect(await favorites.add(memberId, [soup.id])).toBe(1);
			expect(await favorites.list(memberId, everything)).toEqual([soup, pie]);
		});
	});

	describe('has and count', () => {
		it("tell whether a recipe is the member's favorite, and how many they have", async () => {
			const { favorites, memberId, otherMemberId } = fixture();
			const [soup, pie] = await createRecipes();
			await favorites.add(memberId, [soup.id, pie.id]);
			await favorites.add(otherMemberId, [soup.id]);

			expect(await favorites.has(memberId, pie.id)).toBe(true);
			expect(await favorites.has(otherMemberId, pie.id)).toBe(false);
			expect(await favorites.has(memberId, missingId)).toBe(false);
			expect(await favorites.count(memberId)).toBe(2);
			expect(await favorites.count(otherMemberId)).toBe(1);
		});
	});

	describe('a deleted recipe', () => {
		it("leaves every member's favorites", async () => {
			const { favorites, recipes, memberId, otherMemberId } = fixture();
			const [soup, pie] = await createRecipes();
			await favorites.add(memberId, [soup.id, pie.id]);
			await favorites.add(otherMemberId, [soup.id]);

			await recipes.delete(soup.id);

			expect(await favorites.list(memberId, everything)).toEqual([pie]);
			expect(await favorites.has(memberId, soup.id)).toBe(false);
			expect(await favorites.count(memberId)).toBe(1);
			expect(await favorites.count(otherMemberId)).toBe(0);
		});
	});
}
