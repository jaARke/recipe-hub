import 'server-only';
import { and, desc, eq, gte, isNotNull, lt, ne, notExists, or, sql, type SQL } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type {
	ImportFailure,
	ImportSuccess,
	NewRecipeImport,
	RecipeImportLimit,
	RecipeImportRepository,
	UnsavedImport,
} from '@/application/ports/recipe-import-repository';
import type { MemberId } from '@/domain/member/member';
import type { RecipeImport, RecipeImportId } from '@/domain/recipe/recipe-import';
import { boundedTransaction } from '@/infrastructure/db/bounded-transaction';
import {
	recipeImportColumns,
	toRecipeImport,
	toUnsavedImport,
	unsavedImportColumns,
} from '@/infrastructure/db/recipe-import-mapper';
import { recipeImports, recipes } from '@/infrastructure/db/schema';
import { lockForTransaction } from '@/infrastructure/db/transaction-lock';

// Ends with the id, so imports started at the same moment keep one order.
const newestFirst = [desc(recipeImports.createdAt), desc(recipeImports.id)];

// Every image pathname an import's draft names, as a jsonb array of strings.
const draftImagePathnames = sql`jsonb_path_query_array(${recipeImports.draft}, '$.content.images[*].pathname')`;

// What clearing an import's draft writes; the rest of the row stays as a record.
const clearedDraft = { draft: null, sourceUrl: null, updatedAt: sql`now()` };

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
						gte(recipeImports.createdAt, limit.since)
					)
				);
				if (started >= limit.maxImports) {
					return null;
				}
			}

			const [row] = await tx
				.insert(recipeImports)
				.values(recipeImport)
				.returning(recipeImportColumns);
			return toRecipeImport(row!, null);
		});
	}

	async recordSuccess(id: RecipeImportId, success: ImportSuccess): Promise<boolean> {
		return this.finish(id, { ...success, status: 'succeeded' });
	}

	async recordFailure(id: RecipeImportId, failure: ImportFailure): Promise<boolean> {
		return this.finish(id, { ...failure, status: 'failed' });
	}

	async findById(id: RecipeImportId): Promise<RecipeImport | null> {
		const [row] = await this.db
			.select({ recipeImport: recipeImportColumns, savedRecipeSlug: recipes.slug })
			.from(recipeImports)
			.leftJoin(recipes, eq(recipes.importId, recipeImports.id))
			.where(eq(recipeImports.id, id));
		return row === undefined ? null : toRecipeImport(row.recipeImport, row.savedRecipeSlug);
	}

	async listUnsaved(memberId: MemberId, since: Date, limit: number): Promise<UnsavedImport[]> {
		const rows = await this.db
			.select(unsavedImportColumns)
			.from(recipeImports)
			.where(and(eq(recipeImports.memberId, memberId), this.isUnsaved(since)))
			.orderBy(...newestFirst)
			.limit(limit);
		return rows.map(toUnsavedImport);
	}

	async findImagesInUnsavedImports(
		pathnames: readonly string[],
		since: Date,
		excludeMemberId?: MemberId
	): Promise<string[]> {
		const wanted = new Set(pathnames);
		if (wanted.size === 0) {
			return [];
		}

		// The drafts naming any of the pathnames, then each pathname they name that was asked about.
		const rows = await this.db
			.selectDistinct({ pathname: sql<string>`jsonb_array_elements_text(${draftImagePathnames})` })
			.from(recipeImports)
			.where(
				and(
					this.isUnsaved(since),
					sql`${draftImagePathnames} ?| ${sql.param([...wanted])}::text[]`,
					excludeMemberId === undefined ? undefined : ne(recipeImports.memberId, excludeMemberId)
				)
			);
		return rows.map(({ pathname }) => pathname).filter((pathname) => wanted.has(pathname));
	}

	async clearDraft(id: RecipeImportId): Promise<void> {
		await this.db.update(recipeImports).set(clearedDraft).where(eq(recipeImports.id, id));
	}

	async clearDraftsCreatedBefore(cutoff: Date): Promise<number> {
		const rows = await this.db
			.update(recipeImports)
			.set(clearedDraft)
			.where(
				and(
					lt(recipeImports.createdAt, cutoff),
					or(isNotNull(recipeImports.draft), isNotNull(recipeImports.sourceUrl))
				)
			)
			.returning({ id: recipeImports.id });
		return rows.length;
	}

	async failRunningCreatedBefore(cutoff: Date, failure: string): Promise<number> {
		const rows = await this.db
			.update(recipeImports)
			.set({ status: 'failed', failure, updatedAt: sql`now()` })
			.where(and(eq(recipeImports.status, 'running'), lt(recipeImports.createdAt, cutoff)))
			.returning({ id: recipeImports.id });
		return rows.length;
	}

	// Only a running import finishes, and only once.
	private async finish(
		id: RecipeImportId,
		changes: Partial<typeof recipeImports.$inferInsert>
	): Promise<boolean> {
		const rows = await this.db
			.update(recipeImports)
			.set({ ...changes, updatedAt: sql`now()` })
			.where(and(eq(recipeImports.id, id), eq(recipeImports.status, 'running')))
			.returning({ id: recipeImports.id });
		return rows.length > 0;
	}

	// Succeeded since the given time, still holding its draft, and saved as no recipe.
	private isUnsaved(since: Date): SQL | undefined {
		return and(
			eq(recipeImports.status, 'succeeded'),
			isNotNull(recipeImports.draft),
			gte(recipeImports.createdAt, since),
			notExists(
				this.db
					.select({ id: recipes.id })
					.from(recipes)
					.where(eq(recipes.importId, recipeImports.id))
			)
		);
	}
}
