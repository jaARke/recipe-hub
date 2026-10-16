import 'server-only';
import { requireMember } from '@/application/authorization';
import { DeviceFavoritesFullError } from '@/application/favorites/errors';
import type { MergedFavoritesDto } from '@/application/favorites/favorite-dtos';
import { paginationSchema } from '@/application/pagination';
import type { ActorProvider } from '@/application/ports/actor-provider';
import type { DeviceFavorites } from '@/application/ports/device-favorites';
import type { FavoritePage, FavoriteRepository } from '@/application/ports/favorite-repository';
import type { RecipeRepository } from '@/application/ports/recipe-repository';
import { InvalidRecipePageError, RecipeNotFoundError } from '@/application/recipes/errors';
import { toRecipeSummaryDto, type RecipeSummaryPage } from '@/application/recipes/recipe-dtos';
import { recipeIdSchema, type Recipe, type RecipeId } from '@/domain/recipe/recipe';
import { getLogger } from '@/lib/logger';
import { settings } from '@/lib/settings';

const logger = getLogger('favorites');

// Ids arrive from the browser, so a malformed id names no recipe.
function parseRecipeId(id: string): RecipeId {
	const parsed = recipeIdSchema.safeParse(id);
	if (!parsed.success) {
		throw new RecipeNotFoundError();
	}

	return parsed.data;
}

// A member's favorites live in their account, and a signed-out reader's on their device. Every use
// case reads the actor, so a page calls them only behind a Suspense boundary, outside its cache.
export class FavoriteService {
	private readonly favorites: FavoriteRepository;
	private readonly device: DeviceFavorites;
	private readonly recipes: RecipeRepository;
	private readonly actors: ActorProvider;

	constructor(
		favorites: FavoriteRepository,
		device: DeviceFavorites,
		recipes: RecipeRepository,
		actors: ActorProvider
	) {
		this.favorites = favorites;
		this.device = device;
		this.recipes = recipes;
		this.actors = actors;
	}

	// Setting what is already so changes nothing. Only an existing recipe becomes a favorite, while any
	// well-formed id can stop being one, so a deleted recipe's id can still leave a device. Throws
	// DeviceFavoritesFullError when a signed-out reader's device keeps as many as it can.
	async setFavorite(recipeId: string, favorite: boolean): Promise<void> {
		const actor = await this.actors.currentActor();
		const id = favorite ? await this.findRecipeId(recipeId) : parseRecipeId(recipeId);
		if (actor.kind === 'anonymous') {
			await this.setDeviceFavorite(id, favorite);
		} else if (favorite) {
			await this.favorites.add(actor.memberId, [id]);
		} else {
			await this.favorites.remove(actor.memberId, id);
		}
	}

	// False for an id that names no recipe.
	async isFavorite(recipeId: string): Promise<boolean> {
		const actor = await this.actors.currentActor();
		const parsed = recipeIdSchema.safeParse(recipeId);
		if (!parsed.success) {
			return false;
		}

		return actor.kind === 'anonymous'
			? (await this.device.list()).includes(parsed.data)
			: this.favorites.has(actor.memberId, parsed.data);
	}

	// Newest first, leaving out recipes deleted since they were favorited.
	async listFavorites(page: FavoritePage): Promise<RecipeSummaryPage> {
		const result = paginationSchema.safeParse(page);
		if (!result.success) {
			throw new InvalidRecipePageError();
		}

		const actor = await this.actors.currentActor();
		if (actor.kind === 'anonymous') {
			const recipes = await this.existingRecipes(await this.device.list());
			const { limit, offset } = result.data;
			return {
				recipes: recipes.slice(offset, offset + limit).map(toRecipeSummaryDto),
				total: recipes.length,
			};
		}

		const [recipes, total] = await Promise.all([
			this.favorites.list(actor.memberId, result.data),
			this.favorites.count(actor.memberId),
		]);
		return { recipes: recipes.map(toRecipeSummaryDto), total };
	}

	// Adds a signed-out reader's favorites to the account they signed in to, newest first, then clears
	// the device, so merging again adds nothing. A failed add leaves the device's for the next merge.
	async mergeDeviceFavorites(): Promise<MergedFavoritesDto> {
		const actor = requireMember(await this.actors.currentActor());
		const ids = await this.device.list();
		if (ids.length === 0) {
			return { addedCount: 0 };
		}

		const addedCount = await this.favorites.add(actor.memberId, ids);
		await this.device.clear();
		logger.info('Device favorites merged', { memberId: actor.memberId, addedCount });
		return { addedCount };
	}

	// A full device first lets go of the recipes deleted since, so they never hold a place.
	private async setDeviceFavorite(recipeId: RecipeId, favorite: boolean): Promise<void> {
		const ids = await this.device.list();
		if (ids.includes(recipeId) === favorite) {
			return;
		}

		if (!favorite) {
			await this.device.save(ids.filter((id) => id !== recipeId));
			return;
		}

		const { maxPerDevice } = settings.favorites;
		const kept =
			ids.length < maxPerDevice ? ids : (await this.existingRecipes(ids)).map(({ id }) => id);
		if (kept.length >= maxPerDevice) {
			logger.info('Device favorite refused as the device is full', { recipeId });
			throw new DeviceFavoritesFullError();
		}

		await this.device.save([recipeId, ...kept]);
	}

	// The recipes in the order of their ids, which a device keeps few enough of to read in one query.
	private async existingRecipes(ids: readonly RecipeId[]): Promise<Recipe[]> {
		const recipesById = new Map(
			(await this.recipes.findByIds(ids)).map((recipe) => [recipe.id, recipe])
		);
		return ids.flatMap((id) => recipesById.get(id) ?? []);
	}

	private async findRecipeId(id: string): Promise<RecipeId> {
		const recipe = await this.recipes.findById(parseRecipeId(id));
		if (recipe === null) {
			throw new RecipeNotFoundError();
		}

		return recipe.id;
	}
}
