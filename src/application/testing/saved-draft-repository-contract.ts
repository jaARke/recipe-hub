import { describe, expect, it } from 'vitest';
import { SavedDraftEditConflictError } from '@/application/drafts/errors';
import { savedDraftIdSchema, type SavedDraftId } from '@/application/drafts/saved-draft';
import type {
	ImportSuccess,
	RecipeImportRepository,
} from '@/application/ports/recipe-import-repository';
import type {
	NewSavedDraft,
	SavedDraft,
	SavedDraftRepository,
} from '@/application/ports/saved-draft-repository';
import type { MemberId } from '@/domain/member/member';
import type { RecipeImportId } from '@/domain/recipe/recipe-import';

export type SavedDraftRepositoryFixture = {
	drafts: SavedDraftRepository;
	// Where the imports that make drafts are started.
	imports: RecipeImportRepository;
	// Two members the repositories accept.
	memberId: MemberId;
	otherMemberId: MemberId;
	// Moves a draft's last change back in time.
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

// What a link import read, with the draft it makes.
const linkImport: ImportSuccess = {
	draft: {
		provenance: {
			entryMode: 'url',
			sourceUrl: 'https://example.com/lemon-bars',
			aiModel: 'example/model',
		},
		title: 'Lemon bars',
		imported: {
			content: {
				title: 'Lemon bars',
				images: [{ role: 'scan', pathname: 'scan/development/bars.jpg' }],
			},
			problems: [{ path: 'title', message: 'Check the title.' }],
		},
		imagePathnames: ['scan/development/bars.jpg'],
	},
};

// What every SavedDraftRepository guarantees. The caller provides a fresh, empty fixture for each test.
export function describeSavedDraftRepositoryContract(
	fixture: () => SavedDraftRepositoryFixture
): void {
	async function create(draft: Partial<NewSavedDraft> = {}): Promise<SavedDraft> {
		return fixture().drafts.create({ ...lemonBars, memberId: fixture().memberId, ...draft });
	}

	async function startImport(memberId: MemberId = fixture().memberId): Promise<RecipeImportId> {
		const started = await fixture().imports.start({ memberId, mode: 'url' });
		if (started === null) {
			throw new Error('The import was refused');
		}
		return started.id;
	}

	// The draft a link import makes as it succeeds, with the import.
	async function importDraft(
		memberId: MemberId = fixture().memberId
	): Promise<{ importId: RecipeImportId; draft: SavedDraft }> {
		const importId = await startImport(memberId);
		const draftId = await fixture().imports.recordSuccess(importId, linkImport);
		const draft = draftId === null ? null : await fixture().drafts.findById(draftId);
		if (draft === null) {
			throw new Error('The import made no draft');
		}
		return { importId, draft };
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
	});

	describe("an import's draft", () => {
		it('reads back with its import, provenance, and what was read in place of values', async () => {
			const { drafts, memberId } = fixture();

			const { importId, draft } = await importDraft();

			expect(draft).toEqual({
				id: expect.any(String),
				memberId,
				importId,
				provenance: linkImport.draft.provenance,
				title: 'Lemon bars',
				imported: linkImport.draft.imported,
				imagePathnames: ['scan/development/bars.jpg'],
				createdAt: expect.any(Date),
				updatedAt: draft.createdAt,
			});
			expect(draft).not.toHaveProperty('values');
			expect(await drafts.findByImportId(importId)).toEqual(draft);
		});
	});

	describe('update', () => {
		it('replaces the contents and marks the draft saved again, keeping the rest', async () => {
			const { drafts } = fixture();
			const created = await create();
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
				values: lemonSquares.values,
				imagePathnames: [],
				createdAt: created.createdAt,
				updatedAt: expect.any(Date),
			});
			expect(updated?.updatedAt.getTime()).toBeGreaterThan(Date.now() - hourMs);
			expect(await drafts.findById(created.id)).toEqual(updated);
		});

		it('puts the values in place of what an import read, keeping its import and provenance', async () => {
			const { drafts } = fixture();
			const { importId, draft } = await importDraft();

			const updated = await drafts.update(draft.id, {
				...lemonSquares,
				expectedUpdatedAt: draft.updatedAt,
			});

			expect(updated).toEqual({
				id: draft.id,
				memberId: draft.memberId,
				importId,
				provenance: linkImport.draft.provenance,
				...lemonSquares,
				createdAt: draft.createdAt,
				updatedAt: expect.any(Date),
			});
			expect(updated).not.toHaveProperty('imported');
			expect(await drafts.findById(draft.id)).toEqual(updated);
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
		it("lists the member's drafts changed since the time, newest first, without their values", async () => {
			const { drafts, memberId, otherMemberId } = fixture();
			const older = await create({ title: undefined });
			const { draft: newer } = await importDraft();
			const expired = await create();
			await create({ memberId: otherMemberId });
			await importDraft(otherMemberId);
			await fixture().backdate(older.id, new Date(Date.now() - 2 * hourMs));
			await fixture().backdate(newer.id, new Date(Date.now() - hourMs));
			await fixture().backdate(expired.id, new Date(Date.now() - 4 * hourMs));

			const listed = await drafts.list(memberId, new Date(Date.now() - 3 * hourMs));

			expect(listed).toEqual([
				{
					id: newer.id,
					provenance: linkImport.draft.provenance,
					title: 'Lemon bars',
					updatedAt: expect.any(Date),
				},
				{ id: older.id, updatedAt: expect.any(Date) },
			]);
		});
	});

	describe('count', () => {
		it("counts the member's drafts changed since the time, an import's included", async () => {
			const { drafts, memberId, otherMemberId } = fixture();
			const older = await create({ title: undefined });
			await importDraft();
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
		it("finds the pathnames a draft changed since the time names, an import's included", async () => {
			const { drafts } = fixture();
			const expired = await create({ imagePathnames: ['dish/development/old.jpg'] });
			await create();
			await importDraft();
			await fixture().backdate(expired.id, new Date(Date.now() - 2 * hourMs));

			const named = await drafts.findImagesInUse(
				[
					'dish/development/bars.jpg',
					'scan/development/bars.jpg',
					'dish/development/old.jpg',
					'dish/development/unused.jpg',
				],
				new Date(Date.now() - hourMs)
			);

			expect(named.toSorted()).toEqual(['dish/development/bars.jpg', 'scan/development/bars.jpg']);
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
		it('deletes the draft at its version and returns it, and returns null for an id no draft has', async () => {
			const { drafts } = fixture();
			const created = await create();
			const kept = await create();

			expect(await drafts.delete(created.id, created.updatedAt)).toEqual(created);
			expect(await drafts.findById(created.id)).toBeNull();
			expect(await drafts.findById(kept.id)).toEqual(kept);
			expect(await drafts.delete(created.id, created.updatedAt)).toBeNull();
			expect(await drafts.delete(missingId, new Date())).toBeNull();
		});

		it('refuses a version saved over since, and deletes nothing', async () => {
			const { drafts } = fixture();
			const created = await create();
			// Saved right away, so the delete names a version less than a millisecond old.
			const saved = await drafts.update(created.id, {
				...lemonSquares,
				expectedUpdatedAt: created.updatedAt,
			});

			await expect(drafts.delete(created.id, created.updatedAt)).rejects.toThrow(
				SavedDraftEditConflictError
			);
			expect(await drafts.findById(created.id)).toEqual(saved);
		});

		it("deletes an import's draft at the version it was made at", async () => {
			const { drafts } = fixture();
			const { importId, draft } = await importDraft();

			expect(await drafts.delete(draft.id, draft.updatedAt)).toEqual(draft);
			expect(await drafts.findByImportId(importId)).toBeNull();
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
