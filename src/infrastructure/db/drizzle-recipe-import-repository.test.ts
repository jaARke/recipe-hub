import { eq, sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';
import { describeRecipeImportRepositoryContract } from '@/application/testing/recipe-import-repository-contract';
import { memberIdSchema, type MemberId } from '@/domain/member/member';
import type { RecipeImportId } from '@/domain/recipe/recipe-import';
import { DrizzleMemberRepository } from '@/infrastructure/db/drizzle-member-repository';
import { DrizzleRecipeImportRepository } from '@/infrastructure/db/drizzle-recipe-import-repository';
import { DrizzleRecipeRepository } from '@/infrastructure/db/drizzle-recipe-repository';
import { recipeImports } from '@/infrastructure/db/schema';
import { requireBoundedWrites } from '@/infrastructure/db/testing/bounded-writes';
import { createTestDatabase, type TestDatabase } from '@/infrastructure/db/testing/test-database';

const unknownMemberId = memberIdSchema.parse('3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b');
const backdated = new Date('2026-01-01T00:00:00Z');

const uuidV7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

let db: TestDatabase;
let imports: DrizzleRecipeImportRepository;
let memberId: MemberId;
let otherMemberId: MemberId;

beforeEach(async () => {
	db = await createTestDatabase();
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

async function backdate(id: RecipeImportId, createdAt: Date) {
	await db.update(recipeImports).set({ createdAt }).where(eq(recipeImports.id, id));
}

async function startSucceeded(): Promise<RecipeImportId> {
	const started = await imports.start({ memberId, mode: 'url' });
	await imports.recordSuccess(started!.id, {
		draft: { content: { title: 'Weeknight chicken soup' }, problems: [] },
		sourceUrl: 'https://example.com/soup',
	});
	return started!.id;
}

// Refuses any import stored without an advisory lock held, as an unserialized start would be.
async function requireImportLock() {
	await db.execute(
		sql.raw(`create function require_import_lock() returns trigger language plpgsql as $$
begin
	if not exists (
		select 1 from pg_locks where locktype = 'advisory' and pid = pg_backend_pid() and granted
	) then
		raise exception 'import started without the member lock';
	end if;
	return new;
end
$$`)
	);
	await db.execute(
		sql`create trigger require_import_lock before insert on recipe_imports for each row execute function require_import_lock()`
	);
}

describeRecipeImportRepositoryContract(() => ({
	imports,
	recipes: new DrizzleRecipeRepository(db),
	memberId,
	otherMemberId,
	backdate,
}));

describe('start', () => {
	it('assigns time-ordered uuidv7 ids', async () => {
		const first = await imports.start({ memberId, mode: 'url' });
		const second = await imports.start({ memberId, mode: 'photo' });

		expect(first?.id).toMatch(uuidV7);
		expect(second!.id > first!.id).toBe(true);
	});

	it('refuses a member who does not exist', async () => {
		await expect(imports.start({ memberId: unknownMemberId, mode: 'url' })).rejects.toThrow(
			expect.objectContaining({
				cause: expect.objectContaining({ constraint: 'recipe_imports_member_id_users_id_fk' }),
			})
		);
	});

	it('never exceeds the limit when starts run at once', async () => {
		const limit = { maxImports: 3, since: backdated };

		const started = await Promise.all(
			Array.from({ length: 8 }, () => imports.start({ memberId, mode: 'url' }, limit))
		);

		expect(started.filter((recipeImport) => recipeImport !== null)).toHaveLength(3);
		expect(await db.$count(recipeImports)).toBe(3);
	});

	it('holds the member lock while a limited start stores the import', async () => {
		await requireImportLock();

		expect(
			await imports.start({ memberId, mode: 'url' }, { maxImports: 1, since: backdated })
		).not.toBeNull();
	});

	it('starts an import in a bounded transaction, limited or not', async () => {
		await requireBoundedWrites(db, 'recipe_imports');

		expect(
			await imports.start({ memberId, mode: 'url' }, { maxImports: 1, since: backdated })
		).not.toBeNull();
		expect(await imports.start({ memberId, mode: 'photo' })).not.toBeNull();
	});

	it('is checked here by a trigger that refuses an import stored without the lock', async () => {
		await requireImportLock();

		await expect(db.insert(recipeImports).values({ memberId, mode: 'url' })).rejects.toThrow(
			expect.objectContaining({
				cause: expect.objectContaining({ message: 'import started without the member lock' }),
			})
		);
	});
});

describe('findImagesInUnsavedImports', () => {
	it('returns nothing for nothing asked without querying', async () => {
		await startSucceeded();
		const query = vi.spyOn(db.$client, 'query');

		expect(await imports.findImagesInUnsavedImports([], backdated)).toEqual([]);
		expect(query).not.toHaveBeenCalled();
	});
});

describe('the recipe_imports table', () => {
	it('refuses a mode or status outside its lists', async () => {
		await expect(
			db.execute(sql`insert into recipe_imports (member_id, mode) values (${memberId}, 'manual')`)
		).rejects.toThrow(
			expect.objectContaining({
				cause: expect.objectContaining({ constraint: 'recipe_imports_mode_check' }),
			})
		);
		await expect(
			db.execute(
				sql`insert into recipe_imports (member_id, mode, status) values (${memberId}, 'url', 'saved')`
			)
		).rejects.toThrow(
			expect.objectContaining({
				cause: expect.objectContaining({ constraint: 'recipe_imports_status_check' }),
			})
		);
	});

	it('stores the cost exactly and reads it back as a number', async () => {
		const started = await imports.start({ memberId, mode: 'photo' });
		await imports.recordFailure(started!.id, { failure: 'import.failed', costUsd: 0.000123 });

		const [row] = await db
			.select({ cost: sql<string>`${recipeImports.costUsd}::text` })
			.from(recipeImports)
			.where(eq(recipeImports.id, started!.id));

		expect(row?.cost).toBe('0.000123');
		expect((await imports.findById(started!.id))?.costUsd).toBe(0.000123);
	});
});

describe('reading stored drafts', () => {
	it('drops keys the schema does not know', async () => {
		const id = await startSucceeded();
		const stored = await imports.findById(id);
		await db
			.update(recipeImports)
			.set({ draft: sql`${recipeImports.draft} || '{"retiredField": true}'::jsonb` })
			.where(eq(recipeImports.id, id));

		expect(await imports.findById(id)).toEqual(stored);
	});

	it('throws when a draft does not fit the schema, in one import and in the list', async () => {
		const id = await startSucceeded();
		await db
			.update(recipeImports)
			.set({ draft: sql`jsonb_set(${recipeImports.draft}, '{content,title}', '""')` })
			.where(eq(recipeImports.id, id));

		await expect(imports.findById(id)).rejects.toThrow(ZodError);
		await expect(imports.listUnsaved(memberId, backdated, 10)).rejects.toThrow(ZodError);
	});
});
