import { eq, sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { SavedDraftEditConflictError } from '@/application/drafts/errors';
import type { SavedDraftId } from '@/application/drafts/saved-draft';
import { describeSavedDraftRepositoryContract } from '@/application/testing/saved-draft-repository-contract';
import type { MemberId } from '@/domain/member/member';
import type { RecipeImportId } from '@/domain/recipe/recipe-import';
import { DrizzleMemberRepository } from '@/infrastructure/db/drizzle-member-repository';
import { DrizzleRecipeImportRepository } from '@/infrastructure/db/drizzle-recipe-import-repository';
import { DrizzleSavedDraftRepository } from '@/infrastructure/db/drizzle-saved-draft-repository';
import { recipeDrafts, recipeImports } from '@/infrastructure/db/schema';
import { createTestDatabase, type TestDatabase } from '@/infrastructure/db/testing/test-database';

const uuidV7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

let db: TestDatabase;
let drafts: DrizzleSavedDraftRepository;
let imports: DrizzleRecipeImportRepository;
let memberId: MemberId;
let otherMemberId: MemberId;

beforeEach(async () => {
	db = await createTestDatabase();
	drafts = new DrizzleSavedDraftRepository(db);
	imports = new DrizzleRecipeImportRepository(db);
	const members = new DrizzleMemberRepository(db);
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

async function backdate(id: SavedDraftId, updatedAt: Date) {
	await db.update(recipeDrafts).set({ updatedAt }).where(eq(recipeDrafts.id, id));
}

describeSavedDraftRepositoryContract(() => ({
	drafts,
	imports,
	memberId,
	otherMemberId,
	backdate,
}));

// The draft a link import makes as it succeeds.
async function importDraft(): Promise<{ importId: RecipeImportId; draftId: SavedDraftId }> {
	const started = await imports.start({ memberId, mode: 'url' });
	const draftId = await imports.recordSuccess(started!.id, {
		draft: {
			provenance: { entryMode: 'url', sourceUrl: 'https://example.com/soup' },
			title: 'Weeknight chicken soup',
			imported: { content: { title: 'Weeknight chicken soup' }, problems: [] },
			imagePathnames: [],
		},
	});
	return { importId: started!.id, draftId: draftId! };
}

describe('create', () => {
	it('gives the draft a uuidv7 id', async () => {
		const draft = await drafts.create({ memberId, values: {}, imagePathnames: [] });

		expect(draft.id).toMatch(uuidV7);
	});
});

describe("an import's draft", () => {
	it('keeps its provenance without its import once the import is gone', async () => {
		const { importId, draftId } = await importDraft();
		const draft = await drafts.findById(draftId);

		await db.delete(recipeImports).where(eq(recipeImports.id, importId));

		const found = await drafts.findById(draftId);
		expect(found).not.toHaveProperty('importId');
		expect(found).toEqual({ ...draft, importId: undefined });
		expect(found?.provenance).toEqual({ entryMode: 'url', sourceUrl: 'https://example.com/soup' });
	});

	it('drops keys the schema does not know from what was read', async () => {
		const { draftId } = await importDraft();
		const stored = await drafts.findById(draftId);
		await db
			.update(recipeDrafts)
			.set({ imported: sql`${recipeDrafts.imported} || '{"retiredField": true}'::jsonb` })
			.where(eq(recipeDrafts.id, draftId));

		expect(await drafts.findById(draftId)).toEqual(stored);
	});

	it('throws when what was read does not fit the schema', async () => {
		const { draftId } = await importDraft();
		await db
			.update(recipeDrafts)
			.set({ imported: sql`jsonb_set(${recipeDrafts.imported}, '{content,title}', '""')` })
			.where(eq(recipeDrafts.id, draftId));

		await expect(drafts.findById(draftId)).rejects.toThrow(ZodError);
	});
});

describe('the recipe_drafts table', () => {
	it('refuses a draft with neither values nor what an import read', async () => {
		await expect(
			db.execute(sql`insert into recipe_drafts (member_id) values (${memberId})`)
		).rejects.toThrow(
			expect.objectContaining({
				cause: expect.objectContaining({ constraint: 'recipe_drafts_contents_check' }),
			})
		);
	});
});

describe('update', () => {
	it('takes the version as a Date holds it, though Postgres keeps the microseconds', async () => {
		const draft = await drafts.create({ memberId, values: {}, imagePathnames: [] });
		await db
			.update(recipeDrafts)
			.set({ updatedAt: sql`'2026-10-15T12:00:00.123987Z'::timestamptz` })
			.where(eq(recipeDrafts.id, draft.id));
		const loaded = await drafts.findById(draft.id);
		expect(loaded?.updatedAt.toISOString()).toBe('2026-10-15T12:00:00.123Z');

		const updated = await drafts.update(draft.id, {
			title: 'Lemon bars',
			values: {},
			imagePathnames: [],
			expectedUpdatedAt: loaded!.updatedAt,
		});

		expect(updated?.title).toBe('Lemon bars');
		await expect(
			drafts.update(draft.id, {
				values: {},
				imagePathnames: [],
				expectedUpdatedAt: loaded!.updatedAt,
			})
		).rejects.toThrow(SavedDraftEditConflictError);
	});
});

describe('findById', () => {
	it('throws when the provenance is not a valid one', async () => {
		const draft = await drafts.create({ memberId, values: {}, imagePathnames: [] });
		await db
			.update(recipeDrafts)
			.set({ provenance: { entryMode: 'url', sourceUrl: 'not a web address' } })
			.where(eq(recipeDrafts.id, draft.id));

		await expect(drafts.findById(draft.id)).rejects.toThrow(ZodError);
	});
});
