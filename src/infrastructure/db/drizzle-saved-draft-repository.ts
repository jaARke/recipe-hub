import 'server-only';
import { and, arrayOverlaps, desc, eq, gte, lt, ne, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { SavedDraftEditConflictError } from '@/application/drafts/errors';
import type { SavedDraftId } from '@/application/drafts/saved-draft';
import type {
	NewSavedDraft,
	SavedDraft,
	SavedDraftContents,
	SavedDraftRepository,
	SavedDraftSummary,
	SavedDraftUpdate,
} from '@/application/ports/saved-draft-repository';
import type { MemberId } from '@/domain/member/member';
import type { RecipeImportId } from '@/domain/recipe/recipe-import';
import {
	savedDraftColumns,
	savedDraftSummaryColumns,
	toSavedDraft,
	toSavedDraftSummary,
} from '@/infrastructure/db/saved-draft-mapper';
import { recipeDrafts } from '@/infrastructure/db/schema';

// Ends with the id, so drafts saved at the same moment keep one order.
const newestFirst = [desc(recipeDrafts.updatedAt), desc(recipeDrafts.id)];

// The columns a save writes; a title left out is none.
function contentColumns({ title, values, imagePathnames }: SavedDraftContents) {
	return { title: title ?? null, values, imagePathnames: [...imagePathnames] };
}

// Each save moves updatedAt by a millisecond at least, so it versions the draft at a Date's precision.
const savedNow = sql`greatest(now(), ${recipeDrafts.updatedAt} + interval '1 millisecond')`;

// Whether the draft was last saved at the version a save started from. Postgres keeps microseconds
// and a Date milliseconds, cut off rather than rounded as the driver reads it, so the stored time is
// cut to milliseconds before it is compared.
function savedAtVersion(expectedUpdatedAt: Date) {
	return sql`date_trunc('milliseconds', ${recipeDrafts.updatedAt}) = ${expectedUpdatedAt.toISOString()}::timestamptz`;
}

export class DrizzleSavedDraftRepository implements SavedDraftRepository {
	private readonly db: PgDatabase<PgQueryResultHKT>;

	constructor(db: PgDatabase<PgQueryResultHKT>) {
		this.db = db;
	}

	// The import's unique key keeps a second draft for it out in the same statement, so of two saves at
	// once only one is stored.
	async create({
		memberId,
		importId,
		provenance,
		...contents
	}: NewSavedDraft): Promise<SavedDraft | null> {
		const [row] = await this.db
			.insert(recipeDrafts)
			.values({
				memberId,
				importId: importId ?? null,
				provenance: provenance ?? null,
				...contentColumns(contents),
			})
			.onConflictDoNothing({ target: recipeDrafts.importId })
			.returning(savedDraftColumns);
		return row === undefined ? null : toSavedDraft(row);
	}

	// The version is checked in the update's own condition, so a save made since is never replaced.
	async update(
		id: SavedDraftId,
		{ expectedUpdatedAt, ...contents }: SavedDraftUpdate
	): Promise<SavedDraft | null> {
		const [row] = await this.db
			.update(recipeDrafts)
			.set({ ...contentColumns(contents), updatedAt: savedNow })
			.where(and(eq(recipeDrafts.id, id), savedAtVersion(expectedUpdatedAt)))
			.returning(savedDraftColumns);
		if (row !== undefined) {
			return toSavedDraft(row);
		}

		// Nothing was updated: the draft was saved since, or there is none.
		const [current] = await this.db
			.select({ id: recipeDrafts.id })
			.from(recipeDrafts)
			.where(eq(recipeDrafts.id, id));
		if (current !== undefined) {
			throw new SavedDraftEditConflictError();
		}
		return null;
	}

	async findById(id: SavedDraftId): Promise<SavedDraft | null> {
		const [row] = await this.db
			.select(savedDraftColumns)
			.from(recipeDrafts)
			.where(eq(recipeDrafts.id, id));
		return row === undefined ? null : toSavedDraft(row);
	}

	async findByImportId(importId: RecipeImportId): Promise<SavedDraft | null> {
		const [row] = await this.db
			.select(savedDraftColumns)
			.from(recipeDrafts)
			.where(eq(recipeDrafts.importId, importId));
		return row === undefined ? null : toSavedDraft(row);
	}

	async list(memberId: MemberId, since: Date, limit: number): Promise<SavedDraftSummary[]> {
		const rows = await this.db
			.select(savedDraftSummaryColumns)
			.from(recipeDrafts)
			.where(and(eq(recipeDrafts.memberId, memberId), gte(recipeDrafts.updatedAt, since)))
			.orderBy(...newestFirst)
			.limit(limit);
		return rows.map(toSavedDraftSummary);
	}

	async count(memberId: MemberId, since: Date): Promise<number> {
		return this.db.$count(
			recipeDrafts,
			and(eq(recipeDrafts.memberId, memberId), gte(recipeDrafts.updatedAt, since))
		);
	}

	async findImagesInUse(
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
			.selectDistinct({ pathname: sql<string>`unnest(${recipeDrafts.imagePathnames})` })
			.from(recipeDrafts)
			.where(
				and(
					gte(recipeDrafts.updatedAt, since),
					arrayOverlaps(recipeDrafts.imagePathnames, [...wanted]),
					excludeMemberId === undefined ? undefined : ne(recipeDrafts.memberId, excludeMemberId)
				)
			);
		return rows.map(({ pathname }) => pathname).filter((pathname) => wanted.has(pathname));
	}

	async delete(id: SavedDraftId): Promise<SavedDraft | null> {
		const [row] = await this.db
			.delete(recipeDrafts)
			.where(eq(recipeDrafts.id, id))
			.returning(savedDraftColumns);
		return row === undefined ? null : toSavedDraft(row);
	}

	async deleteByImportId(importId: RecipeImportId): Promise<void> {
		await this.db.delete(recipeDrafts).where(eq(recipeDrafts.importId, importId));
	}

	async deleteSavedBefore(cutoff: Date): Promise<number> {
		const rows = await this.db
			.delete(recipeDrafts)
			.where(lt(recipeDrafts.updatedAt, cutoff))
			.returning({ id: recipeDrafts.id });
		return rows.length;
	}
}
