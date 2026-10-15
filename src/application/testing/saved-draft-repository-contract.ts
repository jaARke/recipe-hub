import { describe, expect, it } from 'vitest';
import { savedDraftIdSchema, type SavedDraftId } from '@/application/drafts/saved-draft';
import type { RecipeImportRepository } from '@/application/ports/recipe-import-repository';
import type {
	NewSavedDraft,
	SavedDraft,
	SavedDraftRepository,
} from '@/application/ports/saved-draft-repository';
import type { MemberId } from '@/domain/member/member';
import type { RecipeImportId } from '@/domain/recipe/recipe-import';

export type SavedDraftRepositoryFixture = {
	drafts: SavedDraftRepository;
	// Where the imports drafts continue are started.
	imports: RecipeImportRepository;
	// Two members the repositories accept.
	memberId: MemberId;
	otherMemberId: MemberId;
	// Moves a draft's last save back in time.
	backdate(id: SavedDraftId, updatedAt: Date): Promise<void>;
};

const missingId = savedDraftIdSchema.parse('0199c7a4-2c3e-7b1a-9f00-2a7c1e4b5d6e');

const hourMs = 60 * 60 * 1000;

const lemonBars = {
	title: 'Lemon bars',
	values: { text: { title: 'Lemon bars' }, rows: [{ id: 0, text: '1 cup flour' }] },
	imagePathnames: ['dish/development/bars.jpg', 'scan/development/card.jpg'],
};

const lemonSquares = {
	title: 'Lemon squares',
	values: { text: { title: 'Lemon squares' }, rows: [] },
	imagePathnames: ['dish/development/squares.jpg'],
};

// What every SavedDraftRepository guarantees. The caller provides a fresh, empty fixture for each test.
export function describeSavedDraftRepositoryContract(
	fixture: () => SavedDraftRepositoryFixture
): void {
	async function create(draft: Partial<NewSavedDraft> = {}): Promise<SavedDraft> {
		const created = await fixture().drafts.create({
			...lemonBars,
			memberId: fixture().memberId,
			...draft,
		});
		if (created === null) {
			throw new Error('The draft was refused');
		}
		return created;
	}

	async function startImport(memberId: MemberId = fixture().memberId): Promise<RecipeImportId> {
		const started = await fixture().imports.start({ memberId, mode: 'url' });
		if (started === null) {
			throw new Error('The import was refused');
		}
		return started.id;
	}

	describe('create', () => {
		it('stores the draft and reads it back', async () => {
			const { drafts, memberId } = fixture();

			const created = await create();

			expect(created).toEqual({
				id: expect.any(String),
				memberId,
				...lemonBars,
				createdAt: expect.any(Date),
				updatedAt: created.createdAt,
			});
			expect(await drafts.findById(created.id)).toEqual(created);
		});

		it('stores a draft without a title as one with none', async () => {
			const created = await create({ title: undefined, imagePathnames: [] });

			expect(created).not.toHaveProperty('title');
			expect(created.imagePathnames).toEqual([]);
		});

		it('keeps one draft for an import, which a new one replaces under the same id', async () => {
			const { drafts } = fixture();
			const importId = await startImport();
			const first = await create({ importId });

			const second = await create({ importId, ...lemonSquares });

			expect(second).toEqual({
				...first,
				...lemonSquares,
				updatedAt: expect.any(Date),
			});
			expect(second.updatedAt.getTime()).toBeGreaterThanOrEqual(first.updatedAt.getTime());
			expect(await drafts.findByImportId(importId)).toEqual(second);
		});

		it("never replaces another member's draft for the import", async () => {
			const { drafts, otherMemberId } = fixture();
			const importId = await startImport();
			const first = await create({ importId });

			expect(
				await drafts.create({ ...lemonSquares, memberId: otherMemberId, importId })
			).toBeNull();
			expect(await drafts.findByImportId(importId)).toEqual(first);
		});
	});

	describe('update', () => {
		it('replaces the contents and marks the draft saved again, keeping the rest', async () => {
			const { drafts } = fixture();
			const importId = await startImport();
			const created = await create({ importId });
			await fixture().backdate(created.id, new Date(Date.now() - hourMs));

			const updated = await drafts.update(created.id, {
				values: lemonSquares.values,
				imagePathnames: [],
			});

			expect(updated).toEqual({
				id: created.id,
				memberId: created.memberId,
				importId,
				values: lemonSquares.values,
				imagePathnames: [],
				createdAt: created.createdAt,
				updatedAt: expect.any(Date),
			});
			expect(updated?.updatedAt.getTime()).toBeGreaterThan(Date.now() - hourMs);
			expect(await drafts.findById(created.id)).toEqual(updated);
		});

		it('returns null for an id no draft has', async () => {
			expect(await fixture().drafts.update(missingId, lemonBars)).toBeNull();
		});
	});

	describe('find', () => {
		it('finds nothing for an id or an import no draft has', async () => {
			const { drafts } = fixture();
			await create();

			expect(await drafts.findById(missingId)).toBeNull();
			expect(await drafts.findByImportId(await startImport())).toBeNull();
		});
	});

	describe('list', () => {
		it("lists the member's drafts saved since the time, newest first, without their values", async () => {
			const { drafts, memberId, otherMemberId } = fixture();
			const importId = await startImport();
			const older = await create({ title: undefined });
			const newer = await create({ importId });
			const expired = await create();
			await create({ memberId: otherMemberId });
			await fixture().backdate(older.id, new Date(Date.now() - 2 * hourMs));
			await fixture().backdate(newer.id, new Date(Date.now() - hourMs));
			await fixture().backdate(expired.id, new Date(Date.now() - 4 * hourMs));

			const listed = await drafts.list(memberId, new Date(Date.now() - 3 * hourMs), 10);

			expect(listed).toEqual([
				{ id: newer.id, importId, title: 'Lemon bars', updatedAt: expect.any(Date) },
				{ id: older.id, updatedAt: expect.any(Date) },
			]);
		});

		it('lists only the newest, up to its limit', async () => {
			const { drafts, memberId } = fixture();
			const created: SavedDraft[] = [];
			for (let hours = 3; hours > 0; hours -= 1) {
				const draft = await create();
				await fixture().backdate(draft.id, new Date(Date.now() - hours * hourMs));
				created.push(draft);
			}

			const listed = await drafts.list(memberId, new Date(Date.now() - 4 * hourMs), 2);

			expect(listed.map(({ id }) => id)).toEqual([created[2]?.id, created[1]?.id]);
		});
	});

	describe('findImagesInUse', () => {
		it('finds the pathnames a draft saved since the time names', async () => {
			const { drafts } = fixture();
			const expired = await create({ imagePathnames: ['dish/development/old.jpg'] });
			await create();
			await fixture().backdate(expired.id, new Date(Date.now() - 2 * hourMs));

			const named = await drafts.findImagesInUse(
				['dish/development/bars.jpg', 'dish/development/old.jpg', 'dish/development/unused.jpg'],
				new Date(Date.now() - hourMs)
			);

			expect(named).toEqual(['dish/development/bars.jpg']);
		});

		it("ignores the excluded member's drafts", async () => {
			const { drafts, memberId, otherMemberId } = fixture();
			await create();
			await create({ memberId: otherMemberId, imagePathnames: ['dish/development/theirs.jpg'] });
			const pathnames = ['dish/development/bars.jpg', 'dish/development/theirs.jpg'];
			const since = new Date(Date.now() - hourMs);

			expect(await drafts.findImagesInUse(pathnames, since, memberId)).toEqual([
				'dish/development/theirs.jpg',
			]);
			expect((await drafts.findImagesInUse(pathnames, since, otherMemberId)).toSorted()).toEqual([
				'dish/development/bars.jpg',
			]);
		});

		it('finds nothing among no pathnames', async () => {
			await create();

			expect(await fixture().drafts.findImagesInUse([], new Date(Date.now() - hourMs))).toEqual([]);
		});
	});

	describe('delete', () => {
		it('deletes the draft and returns it, and returns null for an id no draft has', async () => {
			const { drafts } = fixture();
			const created = await create();
			const kept = await create();

			expect(await drafts.delete(created.id)).toEqual(created);
			expect(await drafts.findById(created.id)).toBeNull();
			expect(await drafts.findById(kept.id)).toEqual(kept);
			expect(await drafts.delete(created.id)).toBeNull();
		});

		it("deletes the import's draft, and no other", async () => {
			const { drafts } = fixture();
			const importId = await startImport();
			const continuing = await create({ importId });
			const kept = await create({ importId: await startImport() });

			await drafts.deleteByImportId(importId);

			expect(await drafts.findById(continuing.id)).toBeNull();
			expect(await drafts.findById(kept.id)).toEqual(kept);
		});

		it('deletes every draft last saved before the time, and counts them', async () => {
			const { drafts } = fixture();
			const expired = await create();
			const alsoExpired = await create({ memberId: fixture().otherMemberId });
			const kept = await create();
			await fixture().backdate(expired.id, new Date(Date.now() - 2 * hourMs));
			await fixture().backdate(alsoExpired.id, new Date(Date.now() - 3 * hourMs));

			expect(await drafts.deleteSavedBefore(new Date(Date.now() - hourMs))).toBe(2);
			expect(await drafts.findById(expired.id)).toBeNull();
			expect(await drafts.findById(alsoExpired.id)).toBeNull();
			expect(await drafts.findById(kept.id)).toEqual(kept);
		});
	});
}
