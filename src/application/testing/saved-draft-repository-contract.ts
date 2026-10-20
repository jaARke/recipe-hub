import { describe, expect, it } from 'vitest';
import { SavedDraftEditConflictError } from '@/application/drafts/errors';
import { savedDraftIdSchema, type SavedDraftId } from '@/application/drafts/saved-draft';
import type { RecipeImportRepository } from '@/application/ports/recipe-import-repository';
import type {
	NewSavedDraft,
	SavedDraft,
	SavedDraftRepository,
} from '@/application/ports/saved-draft-repository';
import type { MemberId } from '@/domain/member/member';
import type { Provenance } from '@/domain/recipe/provenance';
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

// What a draft saved from a URL import's review keeps of the import.
const fromLink: Provenance = {
	entryMode: 'url',
	sourceUrl: 'https://example.com/lemon-bars',
	aiModel: 'example/model',
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

		it('keeps the provenance of the import a draft continues, and none for one without', async () => {
			const { drafts, memberId } = fixture();
			const importId = await startImport();

			const continuing = await create({ importId, provenance: fromLink });
			const byHand = await create();

			expect(continuing).toEqual({
				id: expect.any(String),
				memberId,
				importId,
				provenance: fromLink,
				...lemonBars,
				createdAt: expect.any(Date),
				updatedAt: continuing.createdAt,
			});
			expect(await drafts.findById(continuing.id)).toEqual(continuing);
			expect(await drafts.findByImportId(importId)).toEqual(continuing);
			expect(byHand).not.toHaveProperty('provenance');
			expect(await drafts.findById(byHand.id)).not.toHaveProperty('provenance');
		});

		it('stores no second draft for an import, and keeps the first as it was', async () => {
			const { drafts, otherMemberId } = fixture();
			const importId = await startImport();
			const first = await create({ importId });

			expect(
				await drafts.create({ ...lemonSquares, memberId: fixture().memberId, importId })
			).toBeNull();
			expect(
				await drafts.create({ ...lemonSquares, memberId: otherMemberId, importId })
			).toBeNull();
			expect(await drafts.findByImportId(importId)).toEqual(first);
		});

		it('stores one of two drafts for an import saved at once', async () => {
			const { drafts, memberId } = fixture();
			const importId = await startImport();

			const both = await Promise.all([
				drafts.create({ ...lemonBars, memberId, importId }),
				drafts.create({ ...lemonSquares, memberId, importId }),
			]);

			const stored = both.filter((draft) => draft !== null);
			expect(stored).toHaveLength(1);
			expect(await drafts.findByImportId(importId)).toEqual(stored[0]);
		});
	});

	describe('update', () => {
		it('replaces the contents and marks the draft saved again, keeping the rest', async () => {
			const { drafts } = fixture();
			const importId = await startImport();
			const created = await create({ importId, provenance: fromLink });
			const anHourAgo = new Date(Date.now() - hourMs);
			await fixture().backdate(created.id, anHourAgo);

			const updated = await drafts.update(created.id, {
				values: lemonSquares.values,
				imagePathnames: [],
				expectedUpdatedAt: anHourAgo,
			});

			expect(updated).toEqual({
				id: created.id,
				memberId: created.memberId,
				importId,
				provenance: fromLink,
				values: lemonSquares.values,
				imagePathnames: [],
				createdAt: created.createdAt,
				updatedAt: expect.any(Date),
			});
			expect(updated?.updatedAt.getTime()).toBeGreaterThan(Date.now() - hourMs);
			expect(await drafts.findById(created.id)).toEqual(updated);
		});

		it('moves the version a millisecond on at least, so a save in the same millisecond is a new one', async () => {
			const { drafts } = fixture();
			const created = await create();
			// Later than the clock, as a save a moment ago in the same millisecond would leave it.
			const ahead = new Date(Date.now() + hourMs);
			await fixture().backdate(created.id, ahead);

			const updated = await drafts.update(created.id, {
				...lemonSquares,
				expectedUpdatedAt: ahead,
			});

			expect(updated?.updatedAt.getTime()).toBe(ahead.getTime() + 1);
		});

		it('refuses a version saved over since, and changes nothing', async () => {
			const { drafts } = fixture();
			const created = await create();
			// Saved right away, so the next save names a version less than a millisecond old.
			const first = await drafts.update(created.id, {
				...lemonSquares,
				expectedUpdatedAt: created.updatedAt,
			});

			await expect(
				drafts.update(created.id, {
					values: {},
					imagePathnames: [],
					expectedUpdatedAt: created.updatedAt,
				})
			).rejects.toThrow(SavedDraftEditConflictError);
			expect(await drafts.findById(created.id)).toEqual(first);
		});

		it('returns null for an id no draft has', async () => {
			expect(
				await fixture().drafts.update(missingId, { ...lemonBars, expectedUpdatedAt: new Date() })
			).toBeNull();
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
			const newer = await create({ importId, provenance: fromLink });
			const expired = await create();
			await create({ memberId: otherMemberId });
			await fixture().backdate(older.id, new Date(Date.now() - 2 * hourMs));
			await fixture().backdate(newer.id, new Date(Date.now() - hourMs));
			await fixture().backdate(expired.id, new Date(Date.now() - 4 * hourMs));

			const listed = await drafts.list(memberId, new Date(Date.now() - 3 * hourMs), 10);

			expect(listed).toEqual([
				{
					id: newer.id,
					importId,
					provenance: fromLink,
					title: 'Lemon bars',
					updatedAt: expect.any(Date),
				},
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

	describe('count', () => {
		it("counts the member's drafts saved since the time", async () => {
			const { drafts, memberId, otherMemberId } = fixture();
			const older = await create({ title: undefined });
			await create({ importId: await startImport(), provenance: fromLink });
			const expired = await create();
			await create({ memberId: otherMemberId });
			await fixture().backdate(older.id, new Date(Date.now() - 2 * hourMs));
			await fixture().backdate(expired.id, new Date(Date.now() - 4 * hourMs));

			expect(await drafts.count(memberId, new Date(Date.now() - 3 * hourMs))).toBe(2);
			expect(await drafts.count(memberId, new Date(Date.now() - hourMs))).toBe(1);
			expect(await drafts.count(otherMemberId, new Date(Date.now() - hourMs))).toBe(1);
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
