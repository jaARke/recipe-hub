import 'server-only';
import { and, eq, gte, isNull, lt, notInArray, or, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { savedDraftIdSchema, type SavedDraftId } from '@/application/drafts/saved-draft';
import type {
	ImportFailure,
	ImportSuccess,
	NewRecipeImport,
	RecipeImportLimit,
	RecipeImportRepository,
} from '@/application/ports/recipe-import-repository';
import { memberIdSchema, type MemberId } from '@/domain/member/member';
import type { RecipeImport, RecipeImportId } from '@/domain/recipe/recipe-import';
import { boundedTransaction } from '@/infrastructure/db/bounded-transaction';
import { insertProvidedColumns } from '@/infrastructure/db/provided-columns-insert';
import { recipeImportColumns, toRecipeImport } from '@/infrastructure/db/recipe-import-mapper';
import { recipeDrafts, recipeImports, recipes } from '@/infrastructure/db/schema';
import { lockForTransaction } from '@/infrastructure/db/transaction-lock';

// A limited start takes a transaction-scoped lock keyed by this and its member, so the imports it
// counted stay the member's only ones until the new import commits.
const importLockKeyPrefix = 'recipe-hub:recipe-imports:';

export class DrizzleRecipeImportRepository implements RecipeImportRepository {
	private readonly db: PgDatabase<PgQueryResultHKT>;

	constructor(db: PgDatabase<PgQueryResultHKT>) {
		this.db = db;
	}

	async start(
		recipeImport: NewRecipeImport,
		limit?: RecipeImportLimit
	): Promise<RecipeImport | null> {
		return boundedTransaction(this.db, 'starting an import', async (tx) => {
			if (limit !== undefined) {
				await lockForTransaction(tx, importLockKeyPrefix + recipeImport.memberId);
				const started = await tx.$count(
					recipeImports,
					and(
						eq(recipeImports.memberId, recipeImport.memberId),
						gte(recipeImports.createdAt, limit.since),
						// Only a failed import has a failure, and `not in` is never true of null.
						or(
							isNull(recipeImports.failure),
							notInArray(recipeImports.failure, [...(limit.uncountedFailures ?? [])])
						)
					)
				);
				if (started >= limit.maxImports) {
					return null;
				}
			}

			const row = await insertProvidedColumns(
				tx,
				recipeImports,
				{ memberId: recipeImport.memberId, mode: recipeImport.mode },
				recipeImportColumns
			);
			return toRecipeImport(row, null);
		});
	}

	// The draft is created in the success's transaction, so a draft the database refuses leaves the
	// import running.
	async recordSuccess(
		id: RecipeImportId,
		{ draft, ...success }: ImportSuccess
	): Promise<SavedDraftId | null> {
		return boundedTransaction(this.db, 'recording a successful import', async (tx) => {
			const memberId = await this.finish(tx, id, { ...success, status: 'succeeded' });
			if (memberId === null) {
				return null;
			}

			const [created] = await tx
				.insert(recipeDrafts)
				.values({
					memberId,
					importId: id,
					provenance: draft.provenance,
					title: draft.title ?? null,
					imported: draft.imported,
					imagePathnames: [...draft.imagePathnames],
				})
				.returning({ id: recipeDrafts.id });
			return savedDraftIdSchema.parse(created!.id);
		});
	}

	async recordFailure(id: RecipeImportId, failure: ImportFailure): Promise<boolean> {
		return (await this.finish(this.db, id, { ...failure, status: 'failed' })) !== null;
	}

	async findById(id: RecipeImportId): Promise<RecipeImport | null> {
		const [row] = await this.db
			.select({ recipeImport: recipeImportColumns, savedRecipeSlug: recipes.slug })
			.from(recipeImports)
			.leftJoin(recipes, eq(recipes.importId, recipeImports.id))
			.where(eq(recipeImports.id, id));
		return row === undefined ? null : toRecipeImport(row.recipeImport, row.savedRecipeSlug);
	}

	async failRunningCreatedBefore(cutoff: Date, failure: string): Promise<number> {
		const rows = await this.db
			.update(recipeImports)
			.set({ status: 'failed', failure, updatedAt: sql`now()` })
			.where(and(eq(recipeImports.status, 'running'), lt(recipeImports.createdAt, cutoff)))
			.returning({ id: recipeImports.id });
		return rows.length;
	}

	// Only a running import finishes, and only once. Returns its member, or null when no running import
	// has the id.
	private async finish(
		db: PgDatabase<PgQueryResultHKT>,
		id: RecipeImportId,
		changes: Partial<typeof recipeImports.$inferInsert>
	): Promise<MemberId | null> {
		const [row] = await db
			.update(recipeImports)
			.set({ ...changes, updatedAt: sql`now()` })
			.where(and(eq(recipeImports.id, id), eq(recipeImports.status, 'running')))
			.returning({ memberId: recipeImports.memberId });
		return row === undefined ? null : memberIdSchema.parse(row.memberId);
	}
}
