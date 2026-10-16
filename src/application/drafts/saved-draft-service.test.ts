import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { SignInRequiredError } from '@/application/authorization';
import type { SavedDraftId } from '@/application/drafts/saved-draft';
import { SavedDraftService, type SaveDraftInput } from '@/application/drafts/saved-draft-service';
import { ImportUnavailableError } from '@/application/ingestion/errors';
import type { Actor, MemberActor } from '@/application/ports/actor-provider';
import { ImageFolders } from '@/application/recipes/image-folders';
import { anonymousActor, memberActor } from '@/application/testing/actors';
import { FixedActorProvider } from '@/application/testing/fixed-actor-provider';
import { InMemoryImageStore } from '@/application/testing/in-memory-image-store';
import { InMemoryRecipeImportRepository } from '@/application/testing/in-memory-recipe-import-repository';
import { InMemoryRecipeRepository } from '@/application/testing/in-memory-recipe-repository';
import { InMemorySavedDraftRepository } from '@/application/testing/in-memory-saved-draft-repository';
import type { Provenance } from '@/domain/recipe/provenance';
import { recipeContentSchema } from '@/domain/recipe/recipe';
import {
	importDraftCutoff,
	type RecipeImportId,
	type RecipeImportMode,
} from '@/domain/recipe/recipe-import';
import { sampleChickenSoup } from '@/domain/recipe/samples/sample-recipes';
import { daysInMilliseconds } from '@/lib/dates';
import { settings } from '@/lib/settings';

const folders = new ImageFolders('development');

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

const missingId = '0199c7a4-2c3e-7b1a-9f00-2a7c1e4b5d6e';
const malformedId = 'not-a-draft-id';

const unstoredImageMessage = 'This photo didn’t upload. Remove it and add it again.';

// Uploads this environment stored, and one that never finished.
const barsPhoto = 'dish/development/bars.jpg';
const slicePhoto = 'dish/development/slice.jpg';
const cardScan = 'scan/development/card.jpg';
const unfinishedPhoto = 'dish/development/half-sent.jpg';

// What the recipe form sends: its values, which only it reads, the title, and the images they name.
const lemonBars: SaveDraftInput = {
	values: { text: { title: 'Lemon bars' } },
	title: 'Lemon bars',
	imagePathnames: [barsPhoto],
};

// Another member's, which names none of the images, so it never keeps them from the member.
const theirDraft: SaveDraftInput = { ...lemonBars, imagePathnames: [] };

const lifetime = settings.drafts.savedDraftLifetimeDays;

function daysAgo(days: number): Date {
	return new Date(Date.now() - daysInMilliseconds(days));
}

// One store of drafts and imports, with a service per actor. Every upload but the unfinished one is
// stored.
async function createDrafts() {
	const recipes = new InMemoryRecipeRepository();
	const imports = new InMemoryRecipeImportRepository(recipes);
	const drafts = new InMemorySavedDraftRepository();
	const images = new InMemoryImageStore(folders);
	for (const pathname of [barsPhoto, slicePhoto, cardScan]) {
		await images.put(pathname, jpeg, 'image/jpeg');
	}
	const serviceFor = (actor: Actor) =>
		new SavedDraftService(drafts, imports, recipes, images, new FixedActorProvider(actor), folders);
	// An import the member started whose draft awaits their review.
	const importDraft = async (
		actor: MemberActor,
		mode: RecipeImportMode = 'url'
	): Promise<RecipeImportId> => {
		const started = await imports.start({ memberId: actor.memberId, mode });
		if (started === null) {
			throw new Error('The import was refused');
		}
		await imports.recordSuccess(started.id, {
			draft: {
				content: {
					title: 'Weeknight chicken soup',
					images: [{ role: 'scan', pathname: cardScan }],
				},
				problems: [],
			},
			...(mode === 'url' && { sourceUrl: 'https://example.com/soup' }),
			aiModel: 'example/model',
		});
		return started.id;
	};
	const backdateImport = (id: RecipeImportId, days: number) => imports.backdate(id, daysAgo(days));
	const backdateDraft = (id: SavedDraftId, days: number) => drafts.backdate(id, daysAgo(days));
	// The import's review gone, as the cleanup leaves it: its draft and source URL cleared.
	const expireImport = async (id: RecipeImportId) => {
		backdateImport(id, settings.imports.importDraftLifetimeDays + 0.01);
		await imports.clearDraftsCreatedBefore(importDraftCutoff(new Date()));
	};
	return {
		recipes,
		imports,
		drafts,
		serviceFor,
		importDraft,
		backdateImport,
		backdateDraft,
		expireImport,
	};
}

function logLines(spy: MockInstance<(...args: unknown[]) => void>): unknown[] {
	return spy.mock.calls.map(([line]) => JSON.parse(String(line)));
}

let consoleInfo: MockInstance<typeof console.info>;
let consoleWarn: MockInstance<typeof console.warn>;

beforeEach(() => {
	// Keeps log lines out of the test output; the logging tests read them here.
	consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => {});
	consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('an anonymous visitor', () => {
	it.each([
		['getDraft', (service: SavedDraftService) => service.getDraft(missingId)],
		['getImportDraft', (service: SavedDraftService) => service.getImportDraft(missingId)],
		['saveDraft', (service: SavedDraftService) => service.saveDraft(lemonBars)],
		['deleteDraft', (service: SavedDraftService) => service.deleteDraft(missingId)],
		['deleteImportDraft', (service: SavedDraftService) => service.deleteImportDraft(missingId)],
		['listDrafts', (service: SavedDraftService) => service.listDrafts()],
	])('is refused %s', async (_name, call) => {
		const { serviceFor } = await createDrafts();

		await expect(call(serviceFor(anonymousActor()))).rejects.toThrow(SignInRequiredError);
	});
});

describe('saveDraft', () => {
	it('saves whatever the form holds as a new draft, kept for its lifetime after the save', async () => {
		const { serviceFor } = await createDrafts();
		const service = serviceFor(memberActor());

		const saved = await service.saveDraft(lemonBars);

		expect(await service.getDraft(saved.id)).toEqual({
			id: saved.id,
			values: lemonBars.values,
			savedAt: saved.savedAt,
			expiresAt: new Date(saved.savedAt.getTime() + daysInMilliseconds(lifetime)),
		});
		expect(logLines(consoleInfo)).toEqual([
			expect.objectContaining({ message: 'Draft saved', draftId: saved.id }),
		]);
	});

	it('saves over the draft the form opened, keeping its id', async () => {
		const { drafts, serviceFor } = await createDrafts();
		const service = serviceFor(memberActor());
		const first = await service.saveDraft(lemonBars);

		const second = await service.saveDraft({
			draftId: first.id,
			values: { text: { title: '' } },
			imagePathnames: [],
		});

		expect(second.id).toBe(first.id);
		expect(await drafts.findById(first.id)).toMatchObject({
			values: { text: { title: '' } },
			imagePathnames: [],
		});
		expect(await drafts.findById(first.id)).not.toHaveProperty('title');
	});

	it('saves as a new draft over another member’s draft, which stays as it was', async () => {
		const { drafts, serviceFor } = await createDrafts();
		const theirs = await serviceFor(memberActor()).saveDraft(theirDraft);

		const saved = await serviceFor(memberActor()).saveDraft({ ...lemonBars, draftId: theirs.id });

		expect(saved.id).not.toBe(theirs.id);
		expect(await drafts.findById(theirs.id)).toMatchObject({ title: 'Lemon bars' });
	});

	it.each([missingId, malformedId])('saves as a new draft for the id %s', async (draftId) => {
		const { serviceFor } = await createDrafts();

		const saved = await serviceFor(memberActor()).saveDraft({ ...lemonBars, draftId });

		expect(saved.id).not.toBe(draftId);
	});

	it('saves an expired draft as a new one', async () => {
		const { serviceFor, backdateDraft } = await createDrafts();
		const service = serviceFor(memberActor());
		const expired = await service.saveDraft(lemonBars);
		backdateDraft(expired.id, lifetime + 0.01);

		const saved = await service.saveDraft({ ...lemonBars, draftId: expired.id });

		expect(saved.id).not.toBe(expired.id);
	});

	it("keeps one draft for an import's review, which the next save replaces", async () => {
		const member = memberActor();
		const { serviceFor, importDraft } = await createDrafts();
		const service = serviceFor(member);
		const importId = await importDraft(member);

		const first = await service.saveDraft({ ...lemonBars, importId });
		const second = await service.saveDraft({ ...lemonBars, importId, title: 'Lemon squares' });

		expect(second.id).toBe(first.id);
		expect(await service.getImportDraft(importId)).toMatchObject({
			id: first.id,
			continuesImportId: importId,
		});
	});

	it.each<{ mode: RecipeImportMode; provenance: Provenance }>([
		{
			mode: 'url',
			provenance: {
				entryMode: 'url',
				sourceUrl: 'https://example.com/soup',
				aiModel: 'example/model',
			},
		},
		{ mode: 'photo', provenance: { entryMode: 'photo', aiModel: 'example/model' } },
	])(
		'keeps the provenance of the $mode import whose review it saves',
		async ({ mode, provenance }) => {
			const member = memberActor();
			const { drafts, serviceFor, importDraft } = await createDrafts();
			const importId = await importDraft(member, mode);

			const saved = await serviceFor(member).saveDraft({ ...lemonBars, importId });

			expect((await drafts.findById(saved.id))?.provenance).toEqual(provenance);
		}
	);

	it('keeps no provenance for a draft saved without an import', async () => {
		const { drafts, serviceFor } = await createDrafts();

		const saved = await serviceFor(memberActor()).saveDraft(lemonBars);

		expect(await drafts.findById(saved.id)).not.toHaveProperty('provenance');
	});

	it.each<{ name: string; unavailable: (ids: { importId: RecipeImportId }) => Promise<string> }>([
		{ name: 'another member’s import', unavailable: async ({ importId }) => importId },
		{ name: 'a malformed import id', unavailable: async () => 'not-an-import-id' },
	])('refuses to save the review of $name', async ({ unavailable }) => {
		const { serviceFor, importDraft } = await createDrafts();
		const importId = await importDraft(memberActor());

		await expect(
			serviceFor(memberActor()).saveDraft({
				...lemonBars,
				importId: await unavailable({ importId }),
			})
		).rejects.toThrow(ImportUnavailableError);
		expect(logLines(consoleWarn)).toEqual([
			expect.objectContaining({ message: 'Draft save refused for an unavailable import' }),
		]);
	});

	it('refuses to save the review of an import whose draft expired', async () => {
		const member = memberActor();
		const { serviceFor, importDraft, backdateImport } = await createDrafts();
		const importId = await importDraft(member);
		backdateImport(importId, settings.imports.importDraftLifetimeDays + 0.01);

		await expect(serviceFor(member).saveDraft({ ...lemonBars, importId })).rejects.toThrow(
			ImportUnavailableError
		);
	});

	it("refuses an image never stored, or one another member's recipe or draft names, at its place", async () => {
		const { recipes, serviceFor } = await createDrafts();
		const owner = memberActor();
		await recipes.create({
			content: recipeContentSchema.parse({
				...sampleChickenSoup,
				images: [{ role: 'dish', pathname: barsPhoto, size: { width: 2400, height: 1800 } }],
			}),
			provenance: { entryMode: 'manual' },
			contributorId: owner.memberId,
			slugBase: 'chicken-soup',
		});
		await serviceFor(owner).saveDraft({ ...lemonBars, imagePathnames: [slicePhoto] });

		await expect(
			serviceFor(memberActor()).saveDraft({
				...lemonBars,
				imagePathnames: [cardScan, barsPhoto, slicePhoto, unfinishedPhoto],
			})
		).rejects.toThrow(
			expect.objectContaining({
				code: 'draft.invalid',
				problems: [
					{ path: 'images.1.pathname', message: unstoredImageMessage },
					{ path: 'images.2.pathname', message: unstoredImageMessage },
					{ path: 'images.3.pathname', message: unstoredImageMessage },
				],
			})
		);
	});

	it("keeps the images the member's draft already names, and their import's scans", async () => {
		const member = memberActor();
		const { drafts, serviceFor, importDraft } = await createDrafts();
		const service = serviceFor(member);
		const importId = await importDraft(member, 'photo');
		const saved = await service.saveDraft({ ...lemonBars, importId, imagePathnames: [cardScan] });

		await service.saveDraft({ ...lemonBars, importId, imagePathnames: [cardScan, slicePhoto] });

		expect((await drafts.findById(saved.id))?.imagePathnames).toEqual([cardScan, slicePhoto]);
	});
});

describe('getDraft', () => {
	it("returns null for another member's draft, an expired one, and an id no draft has", async () => {
		const member = memberActor();
		const { serviceFor, backdateDraft } = await createDrafts();
		const service = serviceFor(member);
		const theirs = await serviceFor(memberActor()).saveDraft(theirDraft);
		const expired = await service.saveDraft(lemonBars);
		const kept = await service.saveDraft(lemonBars);
		backdateDraft(expired.id, lifetime + 0.01);
		backdateDraft(kept.id, lifetime - 0.01);

		expect(await service.getDraft(theirs.id)).toBeNull();
		expect(await service.getDraft(expired.id)).toBeNull();
		expect(await service.getDraft(missingId)).toBeNull();
		expect(await service.getDraft(malformedId)).toBeNull();
		expect(await service.getDraft(kept.id)).not.toBeNull();
	});

	it('names the import a draft continues only while its review can still be saved', async () => {
		const member = memberActor();
		const { serviceFor, importDraft, backdateImport } = await createDrafts();
		const service = serviceFor(member);
		const open = await importDraft(member);
		const expired = await importDraft(member);
		const openDraft = await service.saveDraft({ ...lemonBars, importId: open });
		const expiredDraft = await service.saveDraft({ ...lemonBars, importId: expired });
		backdateImport(expired, settings.imports.importDraftLifetimeDays + 0.01);

		expect(await service.getDraft(openDraft.id)).toMatchObject({ continuesImportId: open });
		expect(await service.getDraft(expiredDraft.id)).not.toHaveProperty('continuesImportId');
		expect(await service.getImportDraft(expired)).toMatchObject({ id: expiredDraft.id });
	});

	it("says where a draft saved from an import's review came from once the review is gone", async () => {
		const member = memberActor();
		const { serviceFor, importDraft, expireImport } = await createDrafts();
		const service = serviceFor(member);
		const importId = await importDraft(member);
		const saved = await service.saveDraft({ ...lemonBars, importId });
		await expireImport(importId);

		// Saved again where it now opens, the add page, which names the draft and no import.
		const resaved = await service.saveDraft({ ...lemonBars, draftId: saved.id });

		expect(resaved.id).toBe(saved.id);
		expect(await service.getDraft(saved.id)).toEqual({
			id: saved.id,
			mode: 'url',
			sourceUrl: 'https://example.com/soup',
			values: lemonBars.values,
			savedAt: resaved.savedAt,
			expiresAt: new Date(resaved.savedAt.getTime() + daysInMilliseconds(lifetime)),
		});
	});

	it("finds no draft for another member's import", async () => {
		const owner = memberActor();
		const { serviceFor, importDraft } = await createDrafts();
		const importId = await importDraft(owner);
		await serviceFor(owner).saveDraft({ ...lemonBars, importId });

		expect(await serviceFor(memberActor()).getImportDraft(importId)).toBeNull();
		expect(await serviceFor(owner).getImportDraft(malformedId)).toBeNull();
	});
});

describe('deleteDraft', () => {
	it("deletes the member's draft and the import's draft it continues", async () => {
		const member = memberActor();
		const { imports, drafts, serviceFor, importDraft } = await createDrafts();
		const service = serviceFor(member);
		const importId = await importDraft(member);
		const continuing = await service.saveDraft({ ...lemonBars, importId });
		const kept = await service.saveDraft(lemonBars);

		await service.deleteDraft(continuing.id);

		expect(await drafts.findById(continuing.id)).toBeNull();
		expect(await imports.findById(importId)).not.toHaveProperty('draft');
		expect(await drafts.findById(kept.id)).not.toBeNull();
		expect(await service.listDrafts()).toEqual([expect.objectContaining({ id: kept.id })]);
	});

	it("leaves another member's draft, and a missing or malformed id, as they are", async () => {
		const { drafts, serviceFor } = await createDrafts();
		const theirs = await serviceFor(memberActor()).saveDraft(lemonBars);
		const service = serviceFor(memberActor());

		await service.deleteDraft(theirs.id);
		await service.deleteDraft(missingId);
		await service.deleteDraft(malformedId);

		expect(await drafts.findById(theirs.id)).not.toBeNull();
	});
});

describe('deleteImportDraft', () => {
	it("clears the member's import's draft, with the draft that continues it, and keeps the record", async () => {
		const member = memberActor();
		const { imports, drafts, serviceFor, importDraft } = await createDrafts();
		const service = serviceFor(member);
		const importId = await importDraft(member);
		const continuing = await service.saveDraft({ ...lemonBars, importId });

		await service.deleteImportDraft(importId);

		expect(await imports.findById(importId)).toMatchObject({ status: 'succeeded' });
		expect(await imports.findById(importId)).not.toHaveProperty('draft');
		expect(await drafts.findById(continuing.id)).toBeNull();
	});

	it("leaves another member's import as it is", async () => {
		const { imports, serviceFor, importDraft } = await createDrafts();
		const importId = await importDraft(memberActor());

		await serviceFor(memberActor()).deleteImportDraft(importId);
		await serviceFor(memberActor()).deleteImportDraft(malformedId);

		expect(await imports.findById(importId)).toHaveProperty('draft');
	});
});

describe('listDrafts', () => {
	it("lists the member's drafts with their imports' drafts, newest first, each with when it goes", async () => {
		const member = memberActor();
		const { serviceFor, importDraft, backdateImport, backdateDraft } = await createDrafts();
		const service = serviceFor(member);
		const photoImport = await importDraft(member, 'photo');
		const continued = await importDraft(member);
		const expiredImport = await importDraft(member);
		const untitled = await service.saveDraft({ values: {}, imagePathnames: [] });
		const continuing = await service.saveDraft({ ...lemonBars, importId: continued });
		const expired = await service.saveDraft(lemonBars);
		await serviceFor(memberActor()).saveDraft(theirDraft);
		await importDraft(memberActor());
		backdateImport(photoImport, 2);
		backdateImport(continued, 3);
		backdateImport(expiredImport, settings.imports.importDraftLifetimeDays + 0.01);
		backdateDraft(untitled.id, 1);
		backdateDraft(expired.id, lifetime + 0.01);

		const listed = await service.listDrafts();

		expect(listed).toEqual([
			{
				kind: 'saved',
				id: continuing.id,
				continuesImportId: continued,
				mode: 'url',
				title: 'Lemon bars',
				savedAt: continuing.savedAt,
				expiresAt: new Date(continuing.savedAt.getTime() + daysInMilliseconds(lifetime)),
			},
			{
				kind: 'saved',
				id: untitled.id,
				savedAt: expect.any(Date),
				expiresAt: expect.any(Date),
			},
			{
				kind: 'import',
				id: photoImport,
				mode: 'photo',
				title: 'Weeknight chicken soup',
				importedAt: expect.any(Date),
				expiresAt: expect.any(Date),
			},
		]);
		const [, , imported] = listed;
		expect(imported?.expiresAt.getTime()).toBe(
			(imported?.kind === 'import' ? imported.importedAt.getTime() : 0) +
				daysInMilliseconds(settings.imports.importDraftLifetimeDays)
		);
	});

	it("lists a draft saved from an import's review by how the import read it, once the review is gone", async () => {
		const member = memberActor();
		const { serviceFor, importDraft, expireImport } = await createDrafts();
		const service = serviceFor(member);
		const importId = await importDraft(member, 'photo');
		const saved = await service.saveDraft({ ...lemonBars, importId });
		await expireImport(importId);

		expect(await service.listDrafts()).toEqual([
			{
				kind: 'saved',
				id: saved.id,
				mode: 'photo',
				title: 'Lemon bars',
				savedAt: saved.savedAt,
				expiresAt: new Date(saved.savedAt.getTime() + daysInMilliseconds(lifetime)),
			},
		]);
	});

	it('lists only the newest of both, up to its limit', async () => {
		const member = memberActor();
		const { serviceFor, importDraft, backdateImport, backdateDraft } = await createDrafts();
		const service = serviceFor(member);
		const limit = settings.imports.maxUnsavedImports;
		const expected: string[] = [];
		// Saved drafts and imports in turn, each an hour older than the one before.
		for (let index = 0; index <= limit; index += 1) {
			const hours = index / 24;
			if (index % 2 === 0) {
				const { id } = await service.saveDraft(lemonBars);
				backdateDraft(id, hours);
				expected.push(id);
			} else {
				const id = await importDraft(member);
				backdateImport(id, hours);
				expected.push(id);
			}
		}

		const listed = await service.listDrafts();

		expect(listed.map(({ id }) => id)).toEqual(expected.slice(0, limit));
	});
});
