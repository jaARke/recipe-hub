import 'server-only';
import { and, eq, inArray, ne, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { SavedDraftEditConflictError, SavedDraftGoneError } from '@/application/drafts/errors';
import { ImportUnavailableError } from '@/application/ingestion/errors';
import type {
	NewRecipe,
	RecipePage,
	RecipeRepository,
	RecipeUpdate,
	StoredRecipe,
	UpdatedRecipe,
} from '@/application/ports/recipe-repository';
import { RecipeEditConflictError } from '@/application/recipes/errors';
import type { MemberId } from '@/domain/member/member';
import {
	recipeIdSchema,
	type Recipe,
	type RecipeContent,
	type RecipeId,
} from '@/domain/recipe/recipe';
import { slugCandidate } from '@/domain/recipe/slug';
import { boundedTransaction } from '@/infrastructure/db/bounded-transaction';
import { insertProvidedColumns } from '@/infrastructure/db/provided-columns-insert';
import {
	recipeColumns,
	toContentColumns,
	toInsertColumns,
	toRecipe,
	toStoredRecipe,
} from '@/infrastructure/db/recipe-mapper';
import { recipeOrders } from '@/infrastructure/db/recipe-order';
import { oldRecipeSlugs, recipeDrafts, recipes } from '@/infrastructure/db/schema';
import { lockForTransaction } from '@/infrastructure/db/transaction-lock';

// Every slug allocation takes this transaction-scoped lock, so a slug checked free stays free until
// the write that takes it commits. The unique constraint covers current slugs only, not old ones.
const slugLockKey = 'recipe-hub:recipe-slugs';

// The unique constraint that refuses a second recipe from one import.
const importIdConstraint = 'recipes_import_id_unique';

// Whether Postgres refused the query for breaking the named constraint.
function violatesConstraint(error: unknown, constraint: string): boolean {
	const cause = error instanceof Error ? error.cause : undefined;
	return (
		typeof cause === 'object' &&
		cause !== null &&
		'constraint' in cause &&
		cause.constraint === constraint
	);
}

// Every image pathname a recipe lists, as a jsonb array of strings.
const imagePathnames = sql`jsonb_path_query_array(${recipes.content}, '$.images[*].pathname')`;

// Each save moves updatedAt by a millisecond at least, so it versions the recipe at a Date's precision.
function contentChanges(content: RecipeContent) {
	return {
		...toContentColumns(content),
		updatedAt: sql`greatest(now(), ${recipes.updatedAt} + interval '1 millisecond')`,
	};
}

// Locks the draft a recipe is added from, so no save lands between the check and the delete, and
// refuses one that is gone, another member's, or saved since. The driver reads a Date at milliseconds,
// as the version was given.
async function lockDraftToAddFrom(
	tx: PgDatabase<PgQueryResultHKT>,
	{ id, expectedUpdatedAt }: NonNullable<NewRecipe['fromDraft']>,
	contributorId: MemberId
): Promise<void> {
	const [draft] = await tx
		.select({ memberId: recipeDrafts.memberId, updatedAt: recipeDrafts.updatedAt })
		.from(recipeDrafts)
		.where(eq(recipeDrafts.id, id))
		.for('update');
	if (draft === undefined || draft.memberId !== contributorId) {
		throw new SavedDraftGoneError();
	}
	if (draft.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
		throw new SavedDraftEditConflictError();
	}
}

// Whether a recipe other than the excluded one holds the slug, current or old.
async function isSlugTaken(
	tx: PgDatabase<PgQueryResultHKT>,
	slug: string,
	excludeRecipeId?: RecipeId
): Promise<boolean> {
	const rows = await tx
		.select({ slug: recipes.slug })
		.from(recipes)
		.where(
			and(
				eq(recipes.slug, slug),
				excludeRecipeId === undefined ? undefined : ne(recipes.id, excludeRecipeId)
			)
		)
		.unionAll(
			tx
				.select({ slug: oldRecipeSlugs.slug })
				.from(oldRecipeSlugs)
				.where(
					and(
						eq(oldRecipeSlugs.slug, slug),
						excludeRecipeId === undefined ? undefined : ne(oldRecipeSlugs.recipeId, excludeRecipeId)
					)
				)
		);
	return rows.length > 0;
}

// The first candidate no other recipe holds. A recipe's own slugs count as free for it, so retitling
// back takes back an old slug and a base whose first free candidate is the current slug keeps it.
async function findFreeSlug(
	tx: PgDatabase<PgQueryResultHKT>,
	slugBase: string,
	recipeId?: RecipeId
): Promise<string> {
	for (let attempt = 1; ; attempt += 1) {
		const slug = slugCandidate(slugBase, attempt);
		if (!(await isSlugTaken(tx, slug, recipeId))) {
			return slug;
		}
	}
}

async function replaceContent(
	tx: PgDatabase<PgQueryResultHKT>,
	id: RecipeId,
	content: RecipeContent
): Promise<Recipe> {
	const [row] = await tx
		.update(recipes)
		.set(contentChanges(content))
		.where(eq(recipes.id, id))
		.returning(recipeColumns);
	return toRecipe(row!);
}

// Takes the slug, keeps the previous one as an old slug, and releases the new one if it was an old
// slug of this recipe.
async function takeSlug(
	tx: PgDatabase<PgQueryResultHKT>,
	id: RecipeId,
	previousSlug: string,
	slug: string,
	content: RecipeContent
): Promise<Recipe> {
	const [row] = await tx
		.update(recipes)
		.set({ ...contentChanges(content), slug })
		.where(eq(recipes.id, id))
		.returning(recipeColumns);
	await tx
		.delete(oldRecipeSlugs)
		.where(and(eq(oldRecipeSlugs.slug, slug), eq(oldRecipeSlugs.recipeId, id)));
	await tx.insert(oldRecipeSlugs).values({ slug: previousSlug, recipeId: id });
	return toRecipe(row!);
}

export class DrizzleRecipeRepository implements RecipeRepository {
	private readonly db: PgDatabase<PgQueryResultHKT>;

	constructor(db: PgDatabase<PgQueryResultHKT>) {
		this.db = db;
	}

	async findById(id: RecipeId): Promise<Recipe | null> {
		const [row] = await this.db.select(recipeColumns).from(recipes).where(eq(recipes.id, id));
		return row === undefined ? null : toRecipe(row);
	}

	async findStoredById(id: RecipeId): Promise<StoredRecipe | null> {
		const [row] = await this.db.select(recipeColumns).from(recipes).where(eq(recipes.id, id));
		return row === undefined ? null : toStoredRecipe(row);
	}

	async findBySlug(slug: string): Promise<Recipe | null> {
		const [row] = await this.db
			.select(recipeColumns)
			.from(recipes)
			.where(eq(recipes.slug, slug))
			.unionAll(
				this.db
					.select(recipeColumns)
					.from(oldRecipeSlugs)
					.innerJoin(recipes, eq(recipes.id, oldRecipeSlugs.recipeId))
					.where(eq(oldRecipeSlugs.slug, slug))
			);
		return row === undefined ? null : toRecipe(row);
	}

	async findByIds(ids: readonly RecipeId[]): Promise<Recipe[]> {
		if (ids.length === 0) {
			return [];
		}

		const rows = await this.db
			.select(recipeColumns)
			.from(recipes)
			.where(inArray(recipes.id, [...ids]));
		return rows.map(toRecipe);
	}

	async listIds(): Promise<RecipeId[]> {
		const rows = await this.db
			.select({ id: recipes.id })
			.from(recipes)
			.orderBy(...recipeOrders.newest);
		return rows.map(({ id }) => recipeIdSchema.parse(id));
	}

	async list(page: RecipePage): Promise<Recipe[]> {
		const rows = await this.db
			.select(recipeColumns)
			.from(recipes)
			.orderBy(...recipeOrders[page.sort])
			.limit(page.limit)
			.offset(page.offset);
		return rows.map(toRecipe);
	}

	async count(): Promise<number> {
		return this.db.$count(recipes);
	}

	async create(recipe: NewRecipe): Promise<Recipe> {
		try {
			return await boundedTransaction(this.db, 'creating a recipe', async (tx) => {
				await lockForTransaction(tx, slugLockKey);
				const { fromDraft } = recipe;
				if (fromDraft !== undefined) {
					await lockDraftToAddFrom(tx, fromDraft, recipe.contributorId);
				}
				const slug = await findFreeSlug(tx, recipe.slugBase);
				// Names only the row's columns, since the next deployment drops tags while this one serves.
				const row = await insertProvidedColumns(
					tx,
					recipes,
					toInsertColumns(recipe, slug),
					recipeColumns
				);
				if (fromDraft !== undefined) {
					await tx.delete(recipeDrafts).where(eq(recipeDrafts.id, fromDraft.id));
				}
				return toRecipe(row);
			});
		} catch (error) {
			throw violatesConstraint(error, importIdConstraint) ? new ImportUnavailableError() : error;
		}
	}

	async update(id: RecipeId, update: RecipeUpdate): Promise<UpdatedRecipe | null> {
		const { content, expectedUpdatedAt, slugBase } = update;
		return boundedTransaction(this.db, 'updating a recipe', async (tx) => {
			// The slug lock comes before the row lock, in the order every rename takes them.
			if (slugBase !== undefined) {
				await lockForTransaction(tx, slugLockKey);
			}

			// Locked, so the version checked is the one replaced, and edits of one recipe take turns.
			const [current] = await tx
				.select({ slug: recipes.slug, updatedAt: recipes.updatedAt })
				.from(recipes)
				.where(eq(recipes.id, id))
				.for('update');
			if (current === undefined) {
				return null;
			}

			if (current.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
				throw new RecipeEditConflictError();
			}

			const slug = slugBase === undefined ? current.slug : await findFreeSlug(tx, slugBase, id);
			const recipe =
				slug === current.slug
					? await replaceContent(tx, id, content)
					: await takeSlug(tx, id, current.slug, slug, content);
			return { recipe, previousSlug: current.slug };
		});
	}

	async delete(id: RecipeId): Promise<Recipe | null> {
		const [row] = await this.db.delete(recipes).where(eq(recipes.id, id)).returning(recipeColumns);
		return row === undefined ? null : toRecipe(row);
	}

	async findImagesInUse(
		pathnames: readonly string[],
		excludeContributorId?: MemberId
	): Promise<string[]> {
		const wanted = new Set(pathnames);
		if (wanted.size === 0) {
			return [];
		}

		// The recipes listing any of the pathnames, then each pathname they list that was asked about.
		const rows = await this.db
			.selectDistinct({ pathname: sql<string>`jsonb_array_elements_text(${imagePathnames})` })
			.from(recipes)
			.where(
				and(
					sql`${imagePathnames} ?| ${sql.param([...wanted])}::text[]`,
					excludeContributorId === undefined
						? undefined
						: ne(recipes.contributorId, excludeContributorId)
				)
			);
		return rows.map(({ pathname }) => pathname).filter((pathname) => wanted.has(pathname));
	}
}
