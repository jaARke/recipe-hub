import 'server-only';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type { FavoritePage, FavoriteRepository } from '@/application/ports/favorite-repository';
import type { MemberId } from '@/domain/member/member';
import type { Recipe, RecipeId } from '@/domain/recipe/recipe';
import { boundedTransaction } from '@/infrastructure/db/bounded-transaction';
import { recipeColumns, toRecipe } from '@/infrastructure/db/recipe-mapper';
import { favorites, recipes, users } from '@/infrastructure/db/schema';

// Ends with the recipe, so favorites added at the same moment keep one order.
const newestFirst = [desc(favorites.createdAt), desc(favorites.recipeId)];

const microsecond = sql`interval '1 microsecond'`;

export class DrizzleFavoriteRepository implements FavoriteRepository {
	private readonly db: PgDatabase<PgQueryResultHKT>;

	constructor(db: PgDatabase<PgQueryResultHKT>) {
		this.db = db;
	}

	// Stamps the first recipe as the newest and each next one a microsecond older, all after the
	// member's newest favorite, so the order holds within one tick of the clock. The member's row is
	// locked for share and must not be removed, so a removal committing meanwhile either waits and then
	// deletes what this added, or leaves this nothing to add. A transaction of its own bounds the wait.
	async add(memberId: MemberId, recipeIds: readonly RecipeId[]): Promise<number> {
		if (recipeIds.length === 0) {
			return 0;
		}

		const ids = [...recipeIds];
		const newest = sql`(select max(${favorites.createdAt}) from ${favorites} where ${favorites.memberId} = ${memberId})`;
		const position = sql`array_position(${sql.param(ids)}::uuid[], ${recipes.id})`;
		const createdAt = sql<Date>`greatest(now(), ${newest} + ${ids.length} * ${microsecond}) - (${position} - 1) * ${microsecond}`;
		const added = await boundedTransaction(this.db, 'adding favorites', (tx) =>
			tx
				.insert(favorites)
				.select((qb) =>
					qb
						.select({
							memberId: users.id,
							recipeId: recipes.id,
							createdAt: createdAt.as('created_at'),
						})
						.from(users)
						.innerJoin(recipes, inArray(recipes.id, ids))
						.where(and(eq(users.id, memberId), isNull(users.removedAt)))
						.for('share', { of: users })
				)
				.onConflictDoNothing()
				.returning({ recipeId: favorites.recipeId })
		);
		return added.length;
	}

	async remove(memberId: MemberId, recipeId: RecipeId): Promise<void> {
		await this.db
			.delete(favorites)
			.where(and(eq(favorites.memberId, memberId), eq(favorites.recipeId, recipeId)));
	}

	async has(memberId: MemberId, recipeId: RecipeId): Promise<boolean> {
		const count = await this.db.$count(
			favorites,
			and(eq(favorites.memberId, memberId), eq(favorites.recipeId, recipeId))
		);
		return count > 0;
	}

	async list(memberId: MemberId, page: FavoritePage): Promise<Recipe[]> {
		const rows = await this.db
			.select(recipeColumns)
			.from(favorites)
			.innerJoin(recipes, eq(recipes.id, favorites.recipeId))
			.where(eq(favorites.memberId, memberId))
			.orderBy(...newestFirst)
			.limit(page.limit)
			.offset(page.offset);
		return rows.map(toRecipe);
	}

	async count(memberId: MemberId): Promise<number> {
		return this.db.$count(favorites, eq(favorites.memberId, memberId));
	}
}
