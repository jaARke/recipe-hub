import { describe, expect, it } from 'vitest';
import { SignInRequiredError } from '@/application/authorization';
import { DeviceFavoritesFullError } from '@/application/favorites/errors';
import { FavoriteService } from '@/application/favorites/favorite-service';
import type { Actor } from '@/application/ports/actor-provider';
import type { FavoritePage } from '@/application/ports/favorite-repository';
import { InvalidRecipePageError, RecipeNotFoundError } from '@/application/recipes/errors';
import { anonymousActor, memberActor } from '@/application/testing/actors';
import { FixedActorProvider } from '@/application/testing/fixed-actor-provider';
import { InMemoryDeviceFavorites } from '@/application/testing/in-memory-device-favorites';
import { InMemoryFavoriteRepository } from '@/application/testing/in-memory-favorite-repository';
import { InMemoryRecipeRepository } from '@/application/testing/in-memory-recipe-repository';
import { memberIdSchema } from '@/domain/member/member';
import { recipeContentSchema, type Recipe, type RecipeContentInput } from '@/domain/recipe/recipe';
import {
	sampleButtermilkBiscuits,
	sampleChickenSoup,
	sampleLemonIceboxPie,
} from '@/domain/recipe/samples/sample-recipes';
import { slugify } from '@/domain/recipe/slug';
import { settings } from '@/lib/settings';

const missingId = '0199c7a4-2c3e-7b1a-9f00-2a7c1e4b5d6e';
const malformedId = 'not-a-recipe-id';

// Any member id: the fake recipes keep no members to check it against.
const contributorId = memberIdSchema.parse('3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b');

const everything: FavoritePage = { limit: 100, offset: 0 };

// One catalog and one device, with a service per actor.
function createFavorites() {
	const recipes = new InMemoryRecipeRepository();
	const favorites = new InMemoryFavoriteRepository(recipes);
	const device = new InMemoryDeviceFavorites();
	const serviceFor = (actor: Actor) =>
		new FavoriteService(favorites, device, recipes, new FixedActorProvider(actor));
	const create = (input: RecipeContentInput, slugBase?: string): Promise<Recipe> => {
		const content = recipeContentSchema.parse(input);
		return recipes.create({
			content,
			provenance: { entryMode: 'manual' },
			contributorId,
			slugBase: slugBase ?? slugify(content.title),
		});
	};
	// A device holding as many favorites as it keeps, newest first.
	const fillDevice = async (): Promise<Recipe[]> => {
		const filled = [];
		for (let index = 0; index < settings.favorites.maxPerDevice; index += 1) {
			filled.push(await create(sampleChickenSoup, `soup-${index}`));
		}
		await device.save(filled.map(({ id }) => id));
		return filled;
	};
	return { recipes, favorites, device, serviceFor, create, fillDevice };
}

async function titlesListed(service: FavoriteService, page = everything) {
	const { recipes, total } = await service.listFavorites(page);
	return { titles: recipes.map(({ title }) => title), total };
}

describe('setFavorite', () => {
	it("keeps a member's favorites in their account, and none on the device", async () => {
		const { favorites, device, serviceFor, create } = createFavorites();
		const soup = await create(sampleChickenSoup);
		const actor = memberActor();

		await serviceFor(actor).setFavorite(soup.id, true);

		expect(await favorites.has(actor.memberId, soup.id)).toBe(true);
		expect(await device.list()).toEqual([]);
	});

	it("keeps a signed-out reader's favorites on the device, newest first", async () => {
		const { device, serviceFor, create } = createFavorites();
		const soup = await create(sampleChickenSoup);
		const pie = await create(sampleLemonIceboxPie);
		const reader = serviceFor(anonymousActor());

		await reader.setFavorite(soup.id, true);
		await reader.setFavorite(pie.id, true);

		expect(await device.list()).toEqual([pie.id, soup.id]);
	});

	it.each([
		{ who: 'a member', actor: memberActor() },
		{ who: 'a signed-out reader', actor: anonymousActor() },
	])('changes nothing when set to what it already is, for $who', async ({ actor }) => {
		const { serviceFor, create } = createFavorites();
		const soup = await create(sampleChickenSoup);
		const pie = await create(sampleLemonIceboxPie);
		const service = serviceFor(actor);
		await service.setFavorite(soup.id, true);

		await service.setFavorite(pie.id, true);
		await service.setFavorite(soup.id, true);
		await service.setFavorite(pie.id, false);
		await service.setFavorite(pie.id, false);

		expect(await titlesListed(service)).toEqual({ titles: ['Weeknight chicken soup'], total: 1 });
	});

	it.each([
		{ who: 'a member', actor: memberActor() },
		{ who: 'a signed-out reader', actor: anonymousActor() },
	])('refuses to favorite a recipe that does not exist, for $who', async ({ actor }) => {
		const service = createFavorites().serviceFor(actor);

		await expect(service.setFavorite(missingId, true)).rejects.toThrow(RecipeNotFoundError);
		await expect(service.setFavorite(malformedId, true)).rejects.toThrow(RecipeNotFoundError);
		await expect(service.setFavorite(malformedId, false)).rejects.toThrow(RecipeNotFoundError);
	});

	it("takes a deleted recipe's id off the device", async () => {
		const { recipes, device, serviceFor, create } = createFavorites();
		const soup = await create(sampleChickenSoup);
		const pie = await create(sampleLemonIceboxPie);
		await device.save([pie.id, soup.id]);
		await recipes.delete(soup.id);

		await serviceFor(anonymousActor()).setFavorite(soup.id, false);

		expect(await device.list()).toEqual([pie.id]);
	});
});

describe('the device cap', () => {
	it('refuses a favorite past the cap, leaving the device as it was', async () => {
		const { device, serviceFor, create, fillDevice } = createFavorites();
		const filled = await fillDevice();
		const pie = await create(sampleLemonIceboxPie);

		await expect(serviceFor(anonymousActor()).setFavorite(pie.id, true)).rejects.toThrow(
			DeviceFavoritesFullError
		);
		expect(await device.list()).toEqual(filled.map(({ id }) => id));
	});

	it('takes a favorite once another is removed', async () => {
		const { device, serviceFor, create, fillDevice } = createFavorites();
		const [newest, ...rest] = await fillDevice();
		const pie = await create(sampleLemonIceboxPie);
		const reader = serviceFor(anonymousActor());

		await reader.setFavorite(newest!.id, false);
		await reader.setFavorite(pie.id, true);

		expect(await device.list()).toEqual([pie.id, ...rest.map(({ id }) => id)]);
	});

	it('lets go of the recipes deleted since, so a full device takes a new favorite', async () => {
		const { recipes, device, serviceFor, create, fillDevice } = createFavorites();
		const filled = await fillDevice();
		const deleted = filled[3]!;
		await recipes.delete(deleted.id);
		const pie = await create(sampleLemonIceboxPie);

		await serviceFor(anonymousActor()).setFavorite(pie.id, true);

		expect(await device.list()).toEqual([
			pie.id,
			...filled.filter(({ id }) => id !== deleted.id).map(({ id }) => id),
		]);
	});

	it("leaves a member's account without a cap", async () => {
		const { serviceFor, create, fillDevice } = createFavorites();
		const filled = await fillDevice();
		const pie = await create(sampleLemonIceboxPie);
		const member = serviceFor(memberActor());
		for (const recipe of [...filled, pie]) {
			await member.setFavorite(recipe.id, true);
		}

		expect((await member.listFavorites({ limit: 1, offset: 0 })).total).toBe(
			settings.favorites.maxPerDevice + 1
		);
	});
});

describe('isFavorite', () => {
	it("checks a member's account", async () => {
		const { device, serviceFor, create } = createFavorites();
		const soup = await create(sampleChickenSoup);
		const pie = await create(sampleLemonIceboxPie);
		const actor = memberActor();
		await serviceFor(actor).setFavorite(soup.id, true);
		await device.save([pie.id]);

		const member = serviceFor(actor);

		expect(await member.isFavorite(soup.id)).toBe(true);
		expect(await member.isFavorite(pie.id)).toBe(false);
		expect(await serviceFor(memberActor()).isFavorite(soup.id)).toBe(false);
	});

	it("checks a signed-out reader's device", async () => {
		const { device, serviceFor, create } = createFavorites();
		const soup = await create(sampleChickenSoup);
		const pie = await create(sampleLemonIceboxPie);
		await device.save([soup.id]);

		const reader = serviceFor(anonymousActor());

		expect(await reader.isFavorite(soup.id)).toBe(true);
		expect(await reader.isFavorite(pie.id)).toBe(false);
	});

	it('is false for an id that names no recipe', async () => {
		const reader = createFavorites().serviceFor(anonymousActor());

		expect(await reader.isFavorite(missingId)).toBe(false);
		expect(await reader.isFavorite(malformedId)).toBe(false);
	});
});

describe('listFavorites', () => {
	it.each([
		{ who: 'a member', actor: memberActor() },
		{ who: 'a signed-out reader', actor: anonymousActor() },
	])(
		'lists favorites newest first, a page at a time, with the total, for $who',
		async ({ actor }) => {
			const { serviceFor, create } = createFavorites();
			const service = serviceFor(actor);
			for (const content of [sampleButtermilkBiscuits, sampleChickenSoup, sampleLemonIceboxPie]) {
				await service.setFavorite((await create(content)).id, true);
			}

			expect(await titlesListed(service, { limit: 2, offset: 0 })).toEqual({
				titles: ['Lemon icebox pie with a graham cracker crust', 'Weeknight chicken soup'],
				total: 3,
			});
			expect(await titlesListed(service, { limit: 2, offset: 2 })).toEqual({
				titles: ['Buttermilk biscuits'],
				total: 3,
			});
			expect(await titlesListed(service, { limit: 2, offset: 4 })).toEqual({
				titles: [],
				total: 3,
			});
		}
	);

	it("leaves out a signed-out reader's deleted recipes, from the page and the total", async () => {
		const { recipes, device, serviceFor, create } = createFavorites();
		const soup = await create(sampleChickenSoup);
		const pie = await create(sampleLemonIceboxPie);
		const biscuits = await create(sampleButtermilkBiscuits);
		await device.save([biscuits.id, soup.id, pie.id]);
		await recipes.delete(soup.id);

		expect(await titlesListed(serviceFor(anonymousActor()), { limit: 1, offset: 1 })).toEqual({
			titles: ['Lemon icebox pie with a graham cracker crust'],
			total: 2,
		});
	});

	it('summarizes each recipe for its card', async () => {
		const { device, serviceFor, create } = createFavorites();
		const soup = await create(sampleChickenSoup);
		await device.save([soup.id]);

		expect(await serviceFor(anonymousActor()).listFavorites(everything)).toEqual({
			recipes: [
				{
					id: soup.id,
					slug: 'weeknight-chicken-soup',
					title: 'Weeknight chicken soup',
					source: 'Grandpa Lou',
					totalMinutes: 50,
					yield: { kind: 'servings', amount: { min: 6 } },
					chapter: 'soups-salads',
					holidays: [],
					diets: [],
					coverImage: {
						role: 'dish',
						pathname: 'dish/seed/weeknight-chicken-soup.jpg',
						alt: 'A square white bowl of chicken noodle soup with carrots and peppers',
						size: { width: 1600, height: 961 },
					},
					createdAt: soup.createdAt,
				},
			],
			total: 1,
		});
	});

	it.each([
		{ limit: 0, offset: 0 },
		{ limit: 101, offset: 0 },
		{ limit: 10, offset: -1 },
		{ limit: 10, offset: 0.5 },
	])('rejects the page %o', async (page) => {
		const reader = createFavorites().serviceFor(anonymousActor());

		await expect(reader.listFavorites(page)).rejects.toThrow(InvalidRecipePageError);
	});
});

describe('hasDeviceFavoritesToMerge', () => {
	it('is true for a member whose device keeps favorites', async () => {
		const { device, serviceFor, create } = createFavorites();
		const soup = await create(sampleChickenSoup);
		await device.save([soup.id]);

		expect(await serviceFor(memberActor()).hasDeviceFavoritesToMerge()).toBe(true);
	});

	it('is false for a member whose device keeps none', async () => {
		const { serviceFor } = createFavorites();

		expect(await serviceFor(memberActor()).hasDeviceFavoritesToMerge()).toBe(false);
	});

	it('is false once a merge has cleared the device', async () => {
		const { device, serviceFor, create } = createFavorites();
		const soup = await create(sampleChickenSoup);
		await device.save([soup.id]);
		const member = serviceFor(memberActor());

		await member.mergeDeviceFavorites();

		expect(await member.hasDeviceFavoritesToMerge()).toBe(false);
	});

	it("is false for a signed-out reader, whose device's favorites are theirs", async () => {
		const { device, serviceFor, create } = createFavorites();
		const soup = await create(sampleChickenSoup);
		await device.save([soup.id]);

		expect(await serviceFor(anonymousActor()).hasDeviceFavoritesToMerge()).toBe(false);
	});
});

describe('mergeDeviceFavorites', () => {
	it("adds the device's favorites to the account, newest first, and clears the device", async () => {
		const { device, serviceFor, create } = createFavorites();
		const soup = await create(sampleChickenSoup);
		const pie = await create(sampleLemonIceboxPie);
		const biscuits = await create(sampleButtermilkBiscuits);
		const reader = serviceFor(anonymousActor());
		await reader.setFavorite(soup.id, true);
		await reader.setFavorite(pie.id, true);
		const member = serviceFor(memberActor());
		await member.setFavorite(biscuits.id, true);

		expect(await member.mergeDeviceFavorites()).toEqual({ addedCount: 2 });

		expect(await device.list()).toEqual([]);
		expect(await titlesListed(member)).toEqual({
			titles: [
				'Lemon icebox pie with a graham cracker crust',
				'Weeknight chicken soup',
				'Buttermilk biscuits',
			],
			total: 3,
		});
	});

	it("counts only what it added, skipping the account's favorites and deleted recipes", async () => {
		const { recipes, device, serviceFor, create } = createFavorites();
		const soup = await create(sampleChickenSoup);
		const pie = await create(sampleLemonIceboxPie);
		const biscuits = await create(sampleButtermilkBiscuits);
		const member = serviceFor(memberActor());
		await member.setFavorite(soup.id, true);
		await device.save([biscuits.id, pie.id, soup.id]);
		await recipes.delete(biscuits.id);

		expect(await member.mergeDeviceFavorites()).toEqual({ addedCount: 1 });

		expect(await device.list()).toEqual([]);
		expect(await titlesListed(member)).toEqual({
			titles: ['Lemon icebox pie with a graham cracker crust', 'Weeknight chicken soup'],
			total: 2,
		});
	});

	it('merges once, so a second merge adds nothing', async () => {
		const { device, serviceFor, create } = createFavorites();
		const soup = await create(sampleChickenSoup);
		await device.save([soup.id]);
		const member = serviceFor(memberActor());

		expect(await member.mergeDeviceFavorites()).toEqual({ addedCount: 1 });
		expect(await member.mergeDeviceFavorites()).toEqual({ addedCount: 0 });
	});

	it('refuses a signed-out reader, leaving the device as it was', async () => {
		const { device, serviceFor, create } = createFavorites();
		const soup = await create(sampleChickenSoup);
		await device.save([soup.id]);

		await expect(serviceFor(anonymousActor()).mergeDeviceFavorites()).rejects.toThrow(
			SignInRequiredError
		);
		expect(await device.list()).toEqual([soup.id]);
	});
});
