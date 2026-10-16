import { eq, sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { SavedDraftEditConflictError } from '@/application/drafts/errors';
import type { SavedDraftId } from '@/application/drafts/saved-draft';
import { describeSavedDraftRepositoryContract } from '@/application/testing/saved-draft-repository-contract';
import type { MemberId } from '@/domain/member/member';
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

describe('create', () => {
	it('gives the draft a uuidv7 id', async () => {
		const draft = await drafts.create({ memberId, values: {}, imagePathnames: [] });

		expect(draft?.id).toMatch(uuidV7);
	});

	it('keeps the draft and its provenance without its import once the import is gone', async () => {
		const started = await imports.start({ memberId, mode: 'url' });
		const draft = await drafts.create({
			memberId,
			importId: started!.id,
			provenance: { entryMode: 'url', sourceUrl: 'https://example.com/soup' },
			values: {},
			imagePathnames: [],
		});

		await db.delete(recipeImports).where(eq(recipeImports.id, started!.id));

		const found = await drafts.findById(draft!.id);
		expect(found).not.toHaveProperty('importId');
		expect(found).toEqual({ ...draft, importId: undefined });
		expect(found?.provenance).toEqual({ entryMode: 'url', sourceUrl: 'https://example.com/soup' });
	});
});

describe('update', () => {
	it('takes the version as a Date holds it, though Postgres keeps the microseconds', async () => {
		const draft = await drafts.create({ memberId, values: {}, imagePathnames: [] });
		await db
			.update(recipeDrafts)
			.set({ updatedAt: sql`'2026-10-15T12:00:00.123987Z'::timestamptz` })
			.where(eq(recipeDrafts.id, draft!.id));
		const loaded = await drafts.findById(draft!.id);
		expect(loaded?.updatedAt.toISOString()).toBe('2026-10-15T12:00:00.123Z');

		const updated = await drafts.update(draft!.id, {
			title: 'Lemon bars',
			values: {},
			imagePathnames: [],
			expectedUpdatedAt: loaded!.updatedAt,
		});

		expect(updated?.title).toBe('Lemon bars');
		await expect(
			drafts.update(draft!.id, {
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
			.where(eq(recipeDrafts.id, draft!.id));

		await expect(drafts.findById(draft!.id)).rejects.toThrow(ZodError);
	});
});
