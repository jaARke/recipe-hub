import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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

	it('keeps the draft without its import once the import is gone', async () => {
		const started = await imports.start({ memberId, mode: 'url' });
		const draft = await drafts.create({
			memberId,
			importId: started!.id,
			values: {},
			imagePathnames: [],
		});

		await db.delete(recipeImports).where(eq(recipeImports.id, started!.id));

		const found = await drafts.findById(draft!.id);
		expect(found).not.toHaveProperty('importId');
		expect(found).toEqual({ ...draft, importId: undefined });
	});
});
