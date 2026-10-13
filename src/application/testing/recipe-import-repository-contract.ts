import { describe, expect, it } from 'vitest';
import type {
	ImportSuccess,
	RecipeImportLimit,
	RecipeImportRepository,
} from '@/application/ports/recipe-import-repository';
import type { RecipeRepository } from '@/application/ports/recipe-repository';
import type { MemberId } from '@/domain/member/member';
import { recipeContentSchema } from '@/domain/recipe/recipe';
import type { RecipeImage } from '@/domain/recipe/recipe-image';
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
	// Two members the repositories accept.
	memberId: MemberId;
	otherMemberId: MemberId;
	// Moves an import's start back in time.
	backdate(id: RecipeImportId, createdAt: Date): Promise<void>;
};

const missingId = recipeImportIdSchema.parse('0199c7a4-2c3e-7b1a-9f00-2a7c1e4b5d6e');

const hourMs = 60 * 60 * 1000;

const urlSuccess: ImportSuccess = {
	draft: {
		content: {
			title: 'Weeknight chicken soup',
			ingredientSections: [{ lines: [{ text: '1 onion', item: 'onion' }] }],
		},
		problems: [{ path: 'instructionSections', message: 'No steps were found on the page.' }],
	},
	sourceUrl: 'https://example.com/soup',
	aiModel: 'example/model',
	costUsd: 0.0042,
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

	async function startSucceeded(
		success: ImportSuccess = urlSuccess,
		memberId?: MemberId
	): Promise<RecipeImport> {
		const started = await start('url', memberId);
		await fixture().imports.recordSuccess(started.id, success);
		return started;
	}

	// Saves a recipe from the import, as the recipe service does after the member's review.
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
		it('records the draft, source URL, model, and cost of a running import', async () => {
			const { imports } = fixture();
			const started = await start();

			expect(await imports.recordSuccess(started.id, urlSuccess)).toBe(true);

			expect(await imports.findById(started.id)).toEqual({
				...started,
				...urlSuccess,
				status: 'succeeded',
			});
		});

		it('returns false and changes nothing when no running import has the id', async () => {
			const { imports } = fixture();
			const succeeded = await startSucceeded();
			const failed = await start();
			await imports.recordFailure(failed.id, { failure: 'import.failed' });
			const recorded = [await imports.findById(succeeded.id), await imports.findById(failed.id)];

			for (const id of [succeeded.id, failed.id, missingId]) {
				expect(await imports.recordSuccess(id, { draft: { content: {}, problems: [] } })).toBe(
					false
				);
			}
			expect([await imports.findById(succeeded.id), await imports.findById(failed.id)]).toEqual(
				recorded
			);
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

	describe('listUnsaved', () => {
		it("lists the member's succeeded imports since the time that hold a draft and saved no recipe", async () => {
			const { imports, memberId, otherMemberId, backdate } = fixture();
			const since = new Date(Date.now() - hourMs);
			const titled = await startSucceeded();
			const untitled = await startSucceeded({ draft: { content: {}, problems: [] } });
			const photo = await start('photo');
			await imports.recordSuccess(photo.id, {
				draft: { content: { title: 'Grandma’s biscuits' }, problems: [] },
			});
			await start('url');
			await imports.recordFailure((await start('url')).id, { failure: 'import.failed' });
			await startSucceeded(urlSuccess, otherMemberId);
			await saveRecipeFrom(await startSucceeded());
			await imports.clearDraft((await startSucceeded()).id);
			await backdate((await startSucceeded()).id, new Date(since.getTime() - 1));

			const listed = await imports.listUnsaved(memberId, since, 10);

			expect(listed).toEqual([
				{
					id: photo.id,
					mode: 'photo',
					title: 'Grandma’s biscuits',
					createdAt: photo.createdAt,
				},
				{ id: untitled.id, mode: 'url', createdAt: untitled.createdAt },
				{
					id: titled.id,
					mode: 'url',
					title: 'Weeknight chicken soup',
					createdAt: titled.createdAt,
				},
			]);
			expect(listed[1]).not.toHaveProperty('title');
		});

		it('lists at most the limit, newest first', async () => {
			const { imports, memberId } = fixture();
			const started = [];
			for (let count = 0; count < 3; count += 1) {
				started.push(await startSucceeded());
			}

			const listed = await imports.listUnsaved(memberId, new Date(Date.now() - hourMs), 2);

			expect(listed.map(({ id }) => id)).toEqual([started[2]?.id, started[1]?.id]);
		});
	});

	describe('findImagesInUnsavedImports', () => {
		const cardScan: RecipeImage = { role: 'scan', pathname: 'scan/card.jpg' };
		const backScan: RecipeImage = { role: 'scan', pathname: 'scan/card-back.jpg' };
		const otherScan: RecipeImage = { role: 'scan', pathname: 'scan/other-card.jpg' };
		const recentScan: RecipeImage = { role: 'scan', pathname: 'scan/recent-card.jpg' };

		// A photo import whose draft keeps the scans it was read from.
		async function startScanned(images: RecipeImage[], memberId?: MemberId): Promise<RecipeImport> {
			const started = await start('photo', memberId);
			await fixture().imports.recordSuccess(started.id, {
				draft: { content: { title: 'Grandma’s biscuits', images }, problems: [] },
			});
			return started;
		}

		it("finds the given pathnames that an unsaved import's draft names, whoever started it", async () => {
			const { imports, otherMemberId } = fixture();
			await startScanned([cardScan, backScan]);
			// The same scans imported again, as sending a photo import twice does.
			await startScanned([cardScan]);
			await startScanned([otherScan], otherMemberId);

			const named = await imports.findImagesInUnsavedImports(
				[cardScan.pathname, otherScan.pathname, 'scan/unlisted.jpg'],
				new Date(Date.now() - hourMs)
			);

			expect(named.toSorted()).toEqual([cardScan.pathname, otherScan.pathname]);
		});

		it('ignores a draft that was cleared, expired, or had a recipe saved from it', async () => {
			const { imports, backdate } = fixture();
			const since = new Date(Date.now() - hourMs);
			await imports.clearDraft((await startScanned([cardScan])).id);
			await backdate((await startScanned([backScan])).id, new Date(since.getTime() - 1));
			await saveRecipeFrom(await startScanned([otherScan]));
			await backdate((await startScanned([recentScan])).id, since);

			const named = await imports.findImagesInUnsavedImports(
				[cardScan, backScan, otherScan, recentScan].map(({ pathname }) => pathname),
				since
			);

			expect(named).toEqual([recentScan.pathname]);
		});

		it('finds nothing for no pathnames', async () => {
			await startScanned([cardScan]);

			expect(
				await fixture().imports.findImagesInUnsavedImports([], new Date(Date.now() - hourMs))
			).toEqual([]);
		});
	});

	describe('clearDraft', () => {
		it('clears the draft and source URL and keeps the rest as a record', async () => {
			const { imports } = fixture();
			const succeeded = await startSucceeded();

			await imports.clearDraft(succeeded.id);

			const cleared = await imports.findById(succeeded.id);
			expect(cleared).toEqual({
				...succeeded,
				status: 'succeeded',
				aiModel: urlSuccess.aiModel,
				costUsd: urlSuccess.costUsd,
			});
			expect(cleared).not.toHaveProperty('draft');
			expect(cleared).not.toHaveProperty('sourceUrl');
		});
	});

	describe('clearDraftsCreatedBefore', () => {
		it('clears the drafts of imports started before the time, and counts them', async () => {
			const { imports, backdate } = fixture();
			const cutoff = new Date(Date.now() - hourMs);
			const before = new Date(cutoff.getTime() - 1);
			const expired = await startSucceeded();
			await backdate(expired.id, before);
			const failed = await start();
			await imports.recordFailure(failed.id, { failure: 'import.failed' });
			await backdate(failed.id, before);
			const current = await startSucceeded();
			await backdate(current.id, cutoff);

			expect(await imports.clearDraftsCreatedBefore(cutoff)).toBe(1);

			expect(await imports.findById(expired.id)).toEqual({
				...expired,
				status: 'succeeded',
				aiModel: urlSuccess.aiModel,
				costUsd: urlSuccess.costUsd,
				createdAt: before,
			});
			expect(await imports.findById(current.id)).toMatchObject({
				draft: urlSuccess.draft,
				sourceUrl: urlSuccess.sourceUrl,
			});
			expect(await imports.clearDraftsCreatedBefore(cutoff)).toBe(0);
		});
	});
}
