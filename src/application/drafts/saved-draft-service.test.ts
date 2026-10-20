import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { SignInRequiredError } from '@/application/authorization';
import { SavedDraftEditConflictError } from '@/application/drafts/errors';
import type { SavedDraftId } from '@/application/drafts/saved-draft';
import type { SavedDraftRef } from '@/application/drafts/saved-draft-dtos';
import { SavedDraftService, type SaveDraftInput } from '@/application/drafts/saved-draft-service';
import type { Actor, MemberActor } from '@/application/ports/actor-provider';
import { ImageFolders } from '@/application/recipes/image-folders';
import { anonymousActor, memberActor } from '@/application/testing/actors';
import { FixedActorProvider } from '@/application/testing/fixed-actor-provider';
import { InMemoryImageStore } from '@/application/testing/in-memory-image-store';
import { InMemoryRecipeImportRepository } from '@/application/testing/in-memory-recipe-import-repository';
import { InMemoryRecipeRepository } from '@/application/testing/in-memory-recipe-repository';
import { InMemorySavedDraftRepository } from '@/application/testing/in-memory-saved-draft-repository';
import { recipeContentSchema } from '@/domain/recipe/recipe';
import type { ImportDraft, RecipeImportId, RecipeImportMode } from '@/domain/recipe/recipe-import';
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

// What an import read from the card scan.
const soupCard: ImportDraft = {
	content: { title: 'Weeknight chicken soup', images: [{ role: 'scan', pathname: cardScan }] },
	problems: [{ path: 'title', message: 'Check the title.' }],
};

const lifetime = settings.drafts.draftLifetimeDays;

// What a form that opened or saved the draft sends to save over it: its id and its version.
function over({ id, savedAt }: SavedDraftRef): Pick<SaveDraftInput, 'draftId' | 'draftVersion'> {
	return { draftId: id, draftVersion: savedAt.toISOString() };
}

function daysAgo(days: number): Date {
	return new Date(Date.now() - daysInMilliseconds(days));
}

// One store of drafts and imports, with a service per actor. Every upload but the unfinished one is
// stored.
async function createDrafts() {
	const recipes = new InMemoryRecipeRepository();
	const drafts = new InMemorySavedDraftRepository();
	const imports = new InMemoryRecipeImportRepository(recipes, drafts);
	const images = new InMemoryImageStore(folders);
	for (const pathname of [barsPhoto, slicePhoto, cardScan]) {
		await images.put(pathname, jpeg, 'image/jpeg');
	}
	const serviceFor = (actor: Actor) =>
		new SavedDraftService(drafts, recipes, images, new FixedActorProvider(actor), folders);
	// An import the member started, with the draft it made of the card.
	const importDraft = async (
		actor: MemberActor,
		mode: RecipeImportMode = 'url'
	): Promise<{ importId: RecipeImportId; draftId: SavedDraftId }> => {
		const started = await imports.start({ memberId: actor.memberId, mode });
		const draftId =
			started === null
				? null
				: await imports.recordSuccess(started.id, {
						aiModel: 'example/model',
						draft: {
							provenance:
								mode === 'url'
									? {
											entryMode: 'url',
											sourceUrl: 'https://example.com/soup',
											aiModel: 'example/model',
										}
									: { entryMode: 'photo', aiModel: 'example/model' },
							title: 'Weeknight chicken soup',
							imported: soupCard,
							imagePathnames: [cardScan],
						},
					});
		if (started === null || draftId === null) {
			throw new Error('The import made no draft');
		}
		return { importId: started.id, draftId };
	};
	const backdateDraft = (id: SavedDraftId, days: number) => drafts.backdate(id, daysAgo(days));
	return { recipes, imports, drafts, serviceFor, importDraft, backdateDraft };
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
			...over(first),
			values: { text: { title: '' } },
			imagePathnames: [],
		});

		expect(second.id).toBe(first.id);
		expect(second.savedAt.getTime()).toBeGreaterThan(first.savedAt.getTime());
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

	it('refuses to save over a draft another page saved since, which stays as that page saved it', async () => {
		const { drafts, serviceFor } = await createDrafts();
		const service = serviceFor(memberActor());
		const opened = await service.saveDraft(lemonBars);
		const elsewhere = await service.saveDraft({
			...over(opened),
			values: { text: { title: 'Lemon squares' } },
			title: 'Lemon squares',
			imagePathnames: [slicePhoto],
		});

		await expect(
			service.saveDraft({ ...over(opened), values: {}, imagePathnames: [] })
		).rejects.toThrow(SavedDraftEditConflictError);
		expect(await drafts.findById(opened.id)).toMatchObject({
			title: 'Lemon squares',
			imagePathnames: [slicePhoto],
			updatedAt: elsewhere.savedAt,
		});
		expect(logLines(consoleWarn)).toEqual([
			expect.objectContaining({ message: 'Draft save refused as stale', draftId: opened.id }),
		]);
	});

	it.each([
		['no version', undefined],
		['a malformed version', 'yesterday'],
	])('refuses to save over a draft naming %s', async (_name, draftVersion) => {
		const { drafts, serviceFor } = await createDrafts();
		const service = serviceFor(memberActor());
		const opened = await service.saveDraft(lemonBars);

		await expect(
			service.saveDraft({ draftId: opened.id, draftVersion, values: {}, imagePathnames: [] })
		).rejects.toThrow(SavedDraftEditConflictError);
		expect(await drafts.findById(opened.id)).toMatchObject({ title: 'Lemon bars' });
	});

	it.each<RecipeImportMode>(['url', 'photo'])(
		"saves over a %s import's draft, its values taking the place of what was read",
		async (mode) => {
			const member = memberActor();
			const { drafts, serviceFor, importDraft } = await createDrafts();
			const service = serviceFor(member);
			const { importId, draftId } = await importDraft(member, mode);
			const opened = await service.getDraft(draftId);

			const saved = await service.saveDraft({ ...lemonBars, ...over(opened!) });

			expect(saved.id).toBe(draftId);
			const draft = await drafts.findById(draftId);
			expect(draft).toMatchObject({ importId, values: lemonBars.values, title: 'Lemon bars' });
			expect(draft).not.toHaveProperty('imported');
			expect(await service.getDraft(draftId)).toMatchObject({ mode, values: lemonBars.values });
		}
	);

	it('keeps no provenance for a draft saved without an import', async () => {
		const { drafts, serviceFor } = await createDrafts();

		const saved = await serviceFor(memberActor()).saveDraft(lemonBars);

		expect(await drafts.findById(saved.id)).not.toHaveProperty('provenance');
	});

	it("refuses an image never stored, or one another member's recipe or draft names, at its place", async () => {
		const { recipes, serviceFor, importDraft } = await createDrafts();
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
		await importDraft(owner, 'photo');

		await expect(
			serviceFor(memberActor()).saveDraft({
				...lemonBars,
				imagePathnames: [barsPhoto, slicePhoto, cardScan, unfinishedPhoto],
			})
		).rejects.toThrow(
			expect.objectContaining({
				code: 'draft.invalid',
				problems: [
					{ path: 'images.0.pathname', message: unstoredImageMessage },
					{ path: 'images.1.pathname', message: unstoredImageMessage },
					{ path: 'images.2.pathname', message: unstoredImageMessage },
					{ path: 'images.3.pathname', message: unstoredImageMessage },
				],
			})
		);
	});

	it("keeps the scans the member's import's draft already names", async () => {
		const member = memberActor();
		const { drafts, serviceFor, importDraft } = await createDrafts();
		const service = serviceFor(member);
		const { draftId } = await importDraft(member, 'photo');
		const opened = await service.getDraft(draftId);

		await service.saveDraft({
			...lemonBars,
			...over(opened!),
			imagePathnames: [cardScan, slicePhoto],
		});

		expect((await drafts.findById(draftId))?.imagePathnames).toEqual([cardScan, slicePhoto]);
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

	it("opens an import's draft with what was read and where it came from, until the form saves it", async () => {
		const member = memberActor();
		const { serviceFor, importDraft } = await createDrafts();
		const { draftId } = await importDraft(member);

		const opened = await serviceFor(member).getDraft(draftId);

		expect(opened).toEqual({
			id: draftId,
			mode: 'url',
			sourceUrl: 'https://example.com/soup',
			imported: soupCard,
			savedAt: expect.any(Date),
			expiresAt: new Date(opened!.savedAt.getTime() + daysInMilliseconds(lifetime)),
		});
	});
});

describe('getImportDraft', () => {
	it("finds the member's draft an import made, whatever it holds now", async () => {
		const member = memberActor();
		const { serviceFor, importDraft } = await createDrafts();
		const service = serviceFor(member);
		const { importId, draftId } = await importDraft(member, 'photo');
		await service.saveDraft({ ...lemonBars, ...over((await service.getDraft(draftId))!) });

		expect(await service.getImportDraft(importId)).toMatchObject({
			id: draftId,
			mode: 'photo',
			values: lemonBars.values,
		});
	});

	it("finds none for another member's import, a draft deleted or expired, or a malformed id", async () => {
		const owner = memberActor();
		const { serviceFor, importDraft, backdateDraft } = await createDrafts();
		const service = serviceFor(owner);
		const theirs = await importDraft(memberActor());
		const deleted = await importDraft(owner);
		const expired = await importDraft(owner);
		await service.deleteDraft(deleted.draftId);
		backdateDraft(expired.draftId, lifetime + 0.01);

		expect(await service.getImportDraft(theirs.importId)).toBeNull();
		expect(await service.getImportDraft(deleted.importId)).toBeNull();
		expect(await service.getImportDraft(expired.importId)).toBeNull();
		expect(await service.getImportDraft(malformedId)).toBeNull();
	});
});

describe('deleteDraft', () => {
	it("deletes the member's draft, an import's too, and keeps the import's record", async () => {
		const member = memberActor();
		const { imports, drafts, serviceFor, importDraft } = await createDrafts();
		const service = serviceFor(member);
		const { importId, draftId } = await importDraft(member);
		const kept = await service.saveDraft(lemonBars);

		await service.deleteDraft(draftId);

		expect(await drafts.findById(draftId)).toBeNull();
		expect(await imports.findById(importId)).toMatchObject({ status: 'succeeded' });
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

describe('listDrafts', () => {
	it("lists the member's drafts, their imports' included, newest first, each with how it started and when it goes", async () => {
		const member = memberActor();
		const { serviceFor, importDraft, backdateDraft } = await createDrafts();
		const service = serviceFor(member);
		const fromPhotos = await importDraft(member, 'photo');
		const fromLink = await importDraft(member);
		const untitled = await service.saveDraft({ values: {}, imagePathnames: [] });
		const expired = await service.saveDraft(lemonBars);
		const resaved = await service.saveDraft({
			...lemonBars,
			...over((await service.getDraft(fromLink.draftId))!),
		});
		await serviceFor(memberActor()).saveDraft(theirDraft);
		await importDraft(memberActor());
		backdateDraft(fromPhotos.draftId, 2);
		backdateDraft(untitled.id, 1);
		backdateDraft(expired.id, lifetime + 0.01);

		const listed = await service.listDrafts();

		expect(listed).toEqual([
			{
				id: fromLink.draftId,
				mode: 'url',
				title: 'Lemon bars',
				savedAt: resaved.savedAt,
				expiresAt: new Date(resaved.savedAt.getTime() + daysInMilliseconds(lifetime)),
			},
			{ id: untitled.id, savedAt: expect.any(Date), expiresAt: expect.any(Date) },
			{
				id: fromPhotos.draftId,
				mode: 'photo',
				title: 'Weeknight chicken soup',
				savedAt: expect.any(Date),
				expiresAt: expect.any(Date),
			},
		]);
	});

	it.each([
		['a draft', false],
		["an import's draft", true],
	])(
		'lists %s for its lifetime after its last change, with when it goes',
		async (_name, imported) => {
			const member = memberActor();
			const { drafts, serviceFor, importDraft } = await createDrafts();
			const service = serviceFor(member);
			const draftOf = async () =>
				imported ? (await importDraft(member)).draftId : (await service.saveDraft(lemonBars)).id;
			const kept = await draftOf();
			const expired = await draftOf();
			const lastChanged = daysAgo(lifetime - 1);
			drafts.backdate(kept, lastChanged);
			drafts.backdate(expired, daysAgo(lifetime + 1));

			expect(await service.listDrafts()).toEqual([
				expect.objectContaining({
					id: kept,
					savedAt: lastChanged,
					expiresAt: new Date(lastChanged.getTime() + daysInMilliseconds(lifetime)),
				}),
			]);
		}
	);

	it('lists every draft, however many', async () => {
		const { serviceFor } = await createDrafts();
		const service = serviceFor(memberActor());
		for (let count = 0; count < 12; count += 1) {
			await service.saveDraft(lemonBars);
		}

		expect(await service.listDrafts()).toHaveLength(12);
	});
});

describe('countDrafts', () => {
	it("counts the member's drafts until each expires, and not another member's", async () => {
		const { serviceFor, backdateDraft } = await createDrafts();
		const service = serviceFor(memberActor());
		const kept = await service.saveDraft(lemonBars);
		await service.saveDraft({ values: {}, imagePathnames: [] });
		const expired = await service.saveDraft(lemonBars);
		await serviceFor(memberActor()).saveDraft(theirDraft);
		backdateDraft(kept.id, lifetime - 0.01);
		backdateDraft(expired.id, lifetime + 0.01);

		expect(await service.countDrafts()).toBe(2);
	});

	it('counts none for a signed-out visitor', async () => {
		const { serviceFor } = await createDrafts();
		await serviceFor(memberActor()).saveDraft(lemonBars);

		expect(await serviceFor(anonymousActor()).countDrafts()).toBe(0);
	});
});
