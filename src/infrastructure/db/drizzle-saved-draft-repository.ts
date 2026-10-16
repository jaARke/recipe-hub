import 'server-only';
import { and, arrayOverlaps, desc, eq, gte, lt, ne, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type { SavedDraftId } from '@/application/drafts/saved-draft';
import type {
	NewSavedDraft,
	SavedDraft,
	SavedDraftContents,
	SavedDraftRepository,
	SavedDraftSummary,
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

export class DrizzleSavedDraftRepository implements SavedDraftRepository {
	private readonly db: PgDatabase<PgQueryResultHKT>;

	constructor(db: PgDatabase<PgQueryResultHKT>) {
		this.db = db;
	}

	// The import's unique key makes a second draft for it replace the first in the same statement, so
	// two saves at once leave one draft.
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
			.onConflictDoUpdate({
				target: recipeDrafts.importId,
				set: {
					provenance: sql`excluded.provenance`,
					title: sql`excluded.title`,
					values: sql`excluded.values`,
					imagePathnames: sql`excluded.image_pathnames`,
					updatedAt: sql`now()`,
				},
				setWhere: sql`${recipeDrafts.memberId} = excluded.member_id`,
			})
			.returning(savedDraftColumns);
		return row === undefined ? null : toSavedDraft(row);
	}

	async update(id: SavedDraftId, contents: SavedDraftContents): Promise<SavedDraft | null> {
		const [row] = await this.db
			.update(recipeDrafts)
			.set({ ...contentColumns(contents), updatedAt: sql`now()` })
			.where(eq(recipeDrafts.id, id))
			.returning(savedDraftColumns);
		return row === undefined ? null : toSavedDraft(row);
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
