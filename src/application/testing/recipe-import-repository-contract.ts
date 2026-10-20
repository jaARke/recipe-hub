import { describe, expect, it } from 'vitest';
import type {
	ImportSuccess,
	RecipeImportLimit,
	RecipeImportRepository,
} from '@/application/ports/recipe-import-repository';
import type { RecipeRepository } from '@/application/ports/recipe-repository';
import type { SavedDraftRepository } from '@/application/ports/saved-draft-repository';
import type { MemberId } from '@/domain/member/member';
import { recipeContentSchema } from '@/domain/recipe/recipe';
import {
	recipeImportIdSchema,
	type RecipeImport,
	type RecipeImportId,
	type RecipeImportMode,
} from '@/domain/recipe/recipe-import';
import { sampleChickenSoup, sampleTomatoSalad } from '@/domain/recipe/samples/sample-recipes';

export type RecipeImportRepositoryFixture = {
	imports: RecipeImportRepository;
	// Where recipes saved from imports are stored, which the imports report.
	recipes: RecipeRepository;
	// Where the drafts a success makes are stored.
	drafts: SavedDraftRepository;
	// Two members the repositories accept.
	memberId: MemberId;
	otherMemberId: MemberId;
	// Moves an import's start back in time.
	backdate(id: RecipeImportId, createdAt: Date): Promise<void>;
	// Stores a draft naming the import, as no write through the ports does while it runs.
	storeDraftOf(id: RecipeImportId, memberId: MemberId): Promise<void>;
};

const missingId = recipeImportIdSchema.parse('0199c7a4-2c3e-7b1a-9f00-2a7c1e4b5d6e');

const hourMs = 60 * 60 * 1000;

const urlSuccess: ImportSuccess = {
	aiModel: 'example/model',
	costUsd: 0.0042,
	draft: {
		provenance: {
			entryMode: 'url',
			sourceUrl: 'https://example.com/soup',
			aiModel: 'example/model',
		},
		title: 'Weeknight chicken soup',
		imported: {
			content: {
				title: 'Weeknight chicken soup',
				ingredientSections: [{ lines: [{ text: '1 onion', item: 'onion' }] }],
			},
			problems: [{ path: 'instructionSections', message: 'No steps were found on the page.' }],
		},
		imagePathnames: [],
	},
};

// A photo import's success, whose draft keeps the scans it was read from, with no title found.
const photoSuccess: ImportSuccess = {
	draft: {
		provenance: { entryMode: 'photo' },
		imported: {
			content: { images: [{ role: 'scan', pathname: 'scan/development/card.jpg' }] },
			problems: [],
		},
		imagePathnames: ['scan/development/card.jpg'],
	},
};

// What every RecipeImportRepository guarantees. The caller provides a fresh, empty fixture for each test.
export function describeRecipeImportRepositoryContract(
	fixture: () => RecipeImportRepositoryFixture
): void {
	async function start(
		mode: RecipeImportMode = 'url',
		memberId: MemberId = fixture().memberId,
		limit?: RecipeImportLimit
	): Promise<RecipeImport> {
		const started = await fixture().imports.start({ memberId, mode }, limit);
		if (started === null) {
			throw new Error('The import was refused');
		}
		return started;
	}

	async function startSucceeded(): Promise<RecipeImport> {
		const started = await start('url');
		if ((await fixture().imports.recordSuccess(started.id, urlSuccess)) === null) {
			throw new Error('The import was no longer running');
		}
		return started;
	}

	// Saves a recipe from the import, as the recipe service does from the import's draft.
	async function saveRecipeFrom(recipeImport: RecipeImport) {
		return fixture().recipes.create({
			content: recipeContentSchema.parse(sampleChickenSoup),
			provenance: { entryMode: 'url', sourceUrl: 'https://example.com/soup' },
			importId: recipeImport.id,
			contributorId: recipeImport.memberId,
			slugBase: 'weeknight-chicken-soup',
		});
	}

	describe('start', () => {
		it('stores a running import for the member, with nothing recorded yet', async () => {
			const { imports, memberId } = fixture();

			const started = await start('photo');

			expect(started).toEqual({
				id: expect.any(String),
				memberId,
				mode: 'photo',
				status: 'running',
				createdAt: expect.any(Date),
			});
			expect(await imports.findById(started.id)).toEqual(started);
		});

		it("refuses a start once the member's imports since the time reach the limit, failed ones included", async () => {
			const { imports, memberId } = fixture();
			const limit = { maxImports: 3, since: new Date(Date.now() - hourMs) };
			const failed = await start('url', memberId, limit);
			await imports.recordFailure(failed.id, { failure: 'import.failed' });
			await start('photo', memberId, limit);
			await start('url', memberId, limit);

			expect(await imports.start({ memberId, mode: 'url' }, limit)).toBeNull();
		});

		it('leaves out imports that failed with an uncounted failure, and counts every other', async () => {
			const { imports, memberId } = fixture();
			const limit = {
				maxImports: 2,
				since: new Date(Date.now() - hourMs),
				uncountedFailures: ['import.page-refused', 'import.page-unavailable'],
			};
			for (const failure of ['import.page-refused', 'import.page-unavailable']) {
				const refused = await start('url', memberId, limit);
				await imports.recordFailure(refused.id, { failure });
			}
			const failed = await start('url', memberId, limit);
			await imports.recordFailure(failed.id, { failure: 'import.failed' });
			await start('photo', memberId, limit);

			expect(await imports.start({ memberId, mode: 'url' }, limit)).toBeNull();
		});

		it("counts only the member's own imports since the time", async () => {
			const { imports, memberId, otherMemberId, backdate } = fixture();
			const since = new Date(Date.now() - hourMs);
			const limit = { maxImports: 2, since };
			await backdate((await start('url', memberId)).id, new Date(since.getTime() - 1));
			await start('url', otherMemberId);
			await start('url', otherMemberId);
			await start('url', memberId, limit);

			expect(await imports.start({ memberId, mode: 'photo' }, limit)).not.toBeNull();
			expect(await imports.start({ memberId, mode: 'photo' }, limit)).toBeNull();
		});

		it('starts any number of imports without a limit', async () => {
			const { imports, memberId } = fixture();
			for (let count = 0; count < 3; count += 1) {
				await start('url', memberId, { maxImports: 3, since: new Date(Date.now() - hourMs) });
			}

			expect(await imports.start({ memberId, mode: 'url' })).not.toBeNull();
		});
	});

	describe('recordSuccess', () => {
		it('records the model and cost of a running import, and creates its draft for its member', async () => {
			const { imports, drafts, memberId } = fixture();
			const started = await start();

			const draftId = await imports.recordSuccess(started.id, urlSuccess);

			expect(await imports.findById(started.id)).toEqual({
				...started,
				status: 'succeeded',
				aiModel: 'example/model',
				costUsd: 0.0042,
			});
			const draft = await drafts.findById(draftId!);
			expect(draft).toEqual({
				id: draftId,
				memberId,
				importId: started.id,
				provenance: urlSuccess.draft.provenance,
				title: 'Weeknight chicken soup',
				imported: urlSuccess.draft.imported,
				imagePathnames: [],
				createdAt: expect.any(Date),
				updatedAt: draft?.createdAt,
			});
			expect(draft).not.toHaveProperty('values');
		});

		it('keeps the images what was read names, and no title when it found none', async () => {
			const { imports, drafts, otherMemberId } = fixture();
			const started = await start('photo', otherMemberId);

			const draft = await drafts.findById((await imports.recordSuccess(started.id, photoSuccess))!);

			expect(draft).toMatchObject({
				memberId: otherMemberId,
				provenance: { entryMode: 'photo' },
				imagePathnames: ['scan/development/card.jpg'],
			});
			expect(draft).not.toHaveProperty('title');
		});

		it('returns null and changes nothing when no running import has the id', async () => {
			const { imports, drafts } = fixture();
			const succeeded = await startSucceeded();
			const failed = await start();
			await imports.recordFailure(failed.id, { failure: 'import.failed' });
			const recorded = [await imports.findById(succeeded.id), await imports.findById(failed.id)];
			const draft = await drafts.findByImportId(succeeded.id);

			for (const id of [succeeded.id, failed.id, missingId]) {
				expect(await imports.recordSuccess(id, photoSuccess)).toBeNull();
			}
			expect([await imports.findById(succeeded.id), await imports.findById(failed.id)]).toEqual(
				recorded
			);
			expect(await drafts.findByImportId(succeeded.id)).toEqual(draft);
			expect(await drafts.findByImportId(failed.id)).toBeNull();
		});

		it('throws and changes nothing when the import already has a draft, so neither is kept alone', async () => {
			const { imports, drafts, memberId, storeDraftOf } = fixture();
			const started = await start();
			await storeDraftOf(started.id, memberId);
			const draft = await drafts.findByImportId(started.id);

			await expect(imports.recordSuccess(started.id, urlSuccess)).rejects.toThrow();

			expect(await imports.findById(started.id)).toEqual(started);
			expect(await drafts.findByImportId(started.id)).toEqual(draft);
		});
	});

	describe('recordFailure', () => {
		it('records the failure and cost of a running import', async () => {
			const { imports } = fixture();
			const started = await start('photo');

			expect(
				await imports.recordFailure(started.id, { failure: 'import.failed', costUsd: 0.01 })
			).toBe(true);

			expect(await imports.findById(started.id)).toEqual({
				...started,
				status: 'failed',
				failure: 'import.failed',
				costUsd: 0.01,
			});
		});

		it('returns false and changes nothing when no running import has the id', async () => {
			const { imports } = fixture();
			const succeeded = await startSucceeded();
			const recorded = await imports.findById(succeeded.id);

			expect(await imports.recordFailure(succeeded.id, { failure: 'import.failed' })).toBe(false);
			expect(await imports.recordFailure(missingId, { failure: 'import.failed' })).toBe(false);
			expect(await imports.findById(succeeded.id)).toEqual(recorded);
		});
	});

	describe('findById', () => {
		it('returns null when no import has the id', async () => {
			await start();

			expect(await fixture().imports.findById(missingId)).toBeNull();
		});

		it('carries the current slug of the recipe saved from the import', async () => {
			const { imports, recipes } = fixture();
			const succeeded = await startSucceeded();
			const recipe = await saveRecipeFrom(succeeded);
			const content = recipeContentSchema.parse(sampleTomatoSalad);
			await recipes.update(recipe.id, {
				content,
				expectedUpdatedAt: recipe.updatedAt,
				slugBase: 'garden-tomato-salad',
			});

			expect(await imports.findById(succeeded.id)).toMatchObject({
				id: succeeded.id,
				savedRecipeSlug: 'garden-tomato-salad',
			});
		});
	});

	describe('failRunningCreatedBefore', () => {
		it('records imports still running that started before the time as failed, and counts them', async () => {
			const { imports, otherMemberId, backdate } = fixture();
			const cutoff = new Date(Date.now() - hourMs);
			const before = new Date(cutoff.getTime() - 1);
			const interrupted = await start('photo');
			await backdate(interrupted.id, before);
			const othersInterrupted = await start('url', otherMemberId);
			await backdate(othersInterrupted.id, before);
			const succeeded = await startSucceeded();
			await backdate(succeeded.id, before);
			const failed = await start();
			await imports.recordFailure(failed.id, { failure: 'import.failed', costUsd: 0.01 });
			await backdate(failed.id, before);
			const running = await start();
			await backdate(running.id, cutoff);
			const recorded = [
				await imports.findById(succeeded.id),
				await imports.findById(failed.id),
				await imports.findById(running.id),
			];

			expect(await imports.failRunningCreatedBefore(cutoff, 'import.interrupted')).toBe(2);

			expect(await imports.findById(interrupted.id)).toEqual({
				...interrupted,
				status: 'failed',
				failure: 'import.interrupted',
				createdAt: before,
			});
			expect(await imports.findById(othersInterrupted.id)).toMatchObject({
				status: 'failed',
				failure: 'import.interrupted',
			});
			expect([
				await imports.findById(succeeded.id),
				await imports.findById(failed.id),
				await imports.findById(running.id),
			]).toEqual(recorded);
			expect(await imports.failRunningCreatedBefore(cutoff, 'import.interrupted')).toBe(0);
		});
	});
}
