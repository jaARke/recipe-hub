import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { ImageFolders } from '@/application/recipes/image-folders';
import { InMemoryImageStore } from '@/application/testing/in-memory-image-store';
import type { MemberId } from '@/domain/member/member';
import type { RecipeContent } from '@/domain/recipe/recipe';
import type { RecipeImage } from '@/domain/recipe/recipe-image';
import { DrizzleMemberRepository } from '@/infrastructure/db/drizzle-member-repository';
import { DrizzleRecipeImportRepository } from '@/infrastructure/db/drizzle-recipe-import-repository';
import { DrizzleRecipeRepository } from '@/infrastructure/db/drizzle-recipe-repository';
import { recipeDrafts, recipeImports, recipes } from '@/infrastructure/db/schema';
import { createTestDatabase, type TestDatabase } from '@/infrastructure/db/testing/test-database';
import {
	backfillImageSizes,
	backfillReport,
	unsizedPathnames,
	withImageSizes,
	type ImageRecordStore,
	type KeptImage,
	type UnsizedRecord,
} from './backfill';
import { DrizzleImageRecordStore } from './image-records';
import { storedImageSizeReader } from './image-sizes';

const folders = new ImageFolders('development');

const plated = 'dish/development/0b6e2f4a-9c1d-4e8b-a7f3-5d2c1b0a9e8f.jpg';
const cardFront = 'scan/development/3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b.jpg';
const cardBack = 'scan/development/5a1d9e2f-7b3c-4d8e-8f6a-2b3c4d5e6f7a.jpg';
// A photo the sweep removed, which storage no longer holds.
const swept = 'dish/development/7c4e1a3b-9d2f-4a6e-b8c1-3d4e5f6a7b8c.jpg';
// Stored, but no image at all.
const corrupt = 'dish/development/9e8d7c6b-5a4f-4e3d-8c2b-1a0f9e8d7c6b.jpg';

const platedSize = { width: 48, height: 32 };
const frontSize = { width: 24, height: 36 };
const backSize = { width: 36, height: 24 };

async function jpeg(width: number, height: number, orientation?: number): Promise<Uint8Array> {
	const image = sharp({ create: { width, height, channels: 3, background: '#e8dcc8' } }).jpeg();
	const encoded = orientation === undefined ? image : image.withMetadata({ orientation });
	return new Uint8Array(await encoded.toBuffer());
}

// The store holding the plated photo and both sides of the card, but neither the swept photo nor
// anything readable at the corrupt one.
async function storedImages(): Promise<InMemoryImageStore> {
	const images = new InMemoryImageStore(folders);
	await images.put(plated, await jpeg(platedSize.width, platedSize.height), 'image/jpeg');
	await images.put(cardFront, await jpeg(frontSize.width, frontSize.height), 'image/jpeg');
	await images.put(cardBack, await jpeg(backSize.width, backSize.height), 'image/jpeg');
	await images.put(corrupt, new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), 'image/jpeg');
	return images;
}

type FakeRecord = Omit<UnsizedRecord, 'pathnames'> & { images: KeptImage[] };

// Records as a database would hold them, each with its images.
class InMemoryImageRecords implements ImageRecordStore {
	protected readonly records: FakeRecord[];

	constructor(records: readonly FakeRecord[]) {
		this.records = records.map((record) => ({ ...record, images: [...record.images] }));
	}

	imagesOf(id: string): KeptImage[] | undefined {
		return this.records.find((record) => record.id === id)?.images;
	}

	async listUnsized(): Promise<UnsizedRecord[]> {
		return this.records.flatMap(({ images, ...record }) => {
			const pathnames = unsizedPathnames(images);
			return pathnames.length === 0 ? [] : [{ ...record, pathnames }];
		});
	}

	async writeSizes(
		record: UnsizedRecord,
		sizes: ReadonlyMap<string, { width: number; height: number }>
	): Promise<number> {
		const stored = this.records.find(({ kind, id }) => kind === record.kind && id === record.id);
		if (stored === undefined) {
			return 0;
		}
		const sized = unsizedPathnames(stored.images).filter((pathname) => sizes.has(pathname));
		stored.images = withImageSizes(stored.images, sizes);
		return sized.length;
	}
}

// The first record written is deleted between the run listing it and writing it.
class DeletedDuringRunRecords extends InMemoryImageRecords {
	private deleted = false;

	async writeSizes(
		record: UnsizedRecord,
		sizes: ReadonlyMap<string, { width: number; height: number }>
	): Promise<number> {
		if (!this.deleted) {
			this.deleted = true;
			this.records.splice(
				this.records.findIndex(({ id }) => id === record.id),
				1
			);
		}
		return super.writeSizes(record, sizes);
	}
}

// A recipe with a sized cover and the card's two sides without sizes, an import's draft naming the
// card's front and the swept photo, and a saved draft with the plated photo and one never stored.
function records(): FakeRecord[] {
	return [
		{
			kind: 'recipe',
			name: 'lemon-bars',
			id: '0199c7a4-2c3e-7b1a-9f00-000000000001',
			title: 'Lemon bars',
			images: [
				{ pathname: plated, size: platedSize },
				{ pathname: cardFront },
				{ pathname: cardBack },
			],
		},
		{
			kind: 'import-draft',
			name: '0199d2a0-1b2c-7d3e-8f40-000000000001',
			id: '0199d2a0-1b2c-7d3e-8f40-000000000001',
			images: [{ pathname: cardFront }, { pathname: swept }],
		},
		{
			kind: 'saved-draft',
			name: '0199d2a0-1b2c-7d3e-8f40-000000000002',
			id: '0199d2a0-1b2c-7d3e-8f40-000000000002',
			title: 'Lemon squares',
			images: [{ pathname: plated }, {}],
		},
	];
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
	vi.useRealTimers();
});

describe('backfillImageSizes', () => {
	it('lists each image without a size and the size it reads, in a dry run, and writes nothing', async () => {
		const store = new InMemoryImageRecords(records());

		const result = await backfillImageSizes(store, storedImageSizeReader(await storedImages()), {
			write: false,
		});

		expect(result).toEqual({
			write: false,
			records: [
				{
					kind: 'recipe',
					name: 'lemon-bars',
					id: '0199c7a4-2c3e-7b1a-9f00-000000000001',
					title: 'Lemon bars',
					images: [
						{ pathname: cardFront, reading: { kind: 'sized', size: frontSize } },
						{ pathname: cardBack, reading: { kind: 'sized', size: backSize } },
					],
					outcome: { kind: 'pending' },
				},
				{
					kind: 'import-draft',
					name: '0199d2a0-1b2c-7d3e-8f40-000000000001',
					id: '0199d2a0-1b2c-7d3e-8f40-000000000001',
					images: [
						{ pathname: cardFront, reading: { kind: 'sized', size: frontSize } },
						{ pathname: swept, reading: { kind: 'missing' } },
					],
					outcome: { kind: 'pending' },
				},
				{
					kind: 'saved-draft',
					name: '0199d2a0-1b2c-7d3e-8f40-000000000002',
					id: '0199d2a0-1b2c-7d3e-8f40-000000000002',
					title: 'Lemon squares',
					images: [{ pathname: plated, reading: { kind: 'sized', size: platedSize } }],
					outcome: { kind: 'pending' },
				},
			],
		});
		expect(await store.listUnsized()).toHaveLength(3);
	});

	it('writes each size it reads into its record, and leaves an image it cannot read without one', async () => {
		const store = new InMemoryImageRecords(records());

		const result = await backfillImageSizes(store, storedImageSizeReader(await storedImages()), {
			write: true,
		});

		expect(result.records.map(({ outcome }) => outcome)).toEqual([
			{ kind: 'written' },
			{ kind: 'written' },
			{ kind: 'written' },
		]);
		expect(store.imagesOf('0199c7a4-2c3e-7b1a-9f00-000000000001')).toEqual([
			{ pathname: plated, size: platedSize },
			{ pathname: cardFront, size: frontSize },
			{ pathname: cardBack, size: backSize },
		]);
		expect(store.imagesOf('0199d2a0-1b2c-7d3e-8f40-000000000001')).toEqual([
			{ pathname: cardFront, size: frontSize },
			{ pathname: swept },
		]);
		expect(store.imagesOf('0199d2a0-1b2c-7d3e-8f40-000000000002')).toEqual([
			{ pathname: plated, size: platedSize },
			{},
		]);
		expect(logLines(consoleWarn)).toEqual([
			{
				level: 'warn',
				logger: 'backfill-image-sizes',
				message: 'Image size not read',
				kind: 'import-draft',
				id: '0199d2a0-1b2c-7d3e-8f40-000000000001',
				pathname: swept,
				reason: 'missing',
			},
		]);
		expect(logLines(consoleInfo)).toContainEqual({
			level: 'info',
			logger: 'backfill-image-sizes',
			message: 'Image sizes written',
			kind: 'recipe',
			id: '0199c7a4-2c3e-7b1a-9f00-000000000001',
			imagesSized: 2,
		});
	});

	it('reads again on a second run only the images the first could not', async () => {
		const store = new InMemoryImageRecords(records());
		const images = await storedImages();
		await backfillImageSizes(store, storedImageSizeReader(images), { write: true });
		const reads = vi.spyOn(images, 'get');

		const result = await backfillImageSizes(store, storedImageSizeReader(images), {
			write: true,
		});

		expect(result.records.map(({ kind, images, outcome }) => ({ kind, images, outcome }))).toEqual([
			{
				kind: 'import-draft',
				images: [{ pathname: swept, reading: { kind: 'missing' } }],
				outcome: { kind: 'skipped', reason: 'unread' },
			},
		]);
		expect(reads.mock.calls.map(([pathname]) => pathname)).toEqual([swept]);
	});

	it('reads each image once, however many records name it', async () => {
		const images = await storedImages();
		const reads = vi.spyOn(images, 'get');

		await backfillImageSizes(new InMemoryImageRecords(records()), storedImageSizeReader(images), {
			write: false,
		});

		expect(reads.mock.calls.map(([pathname]) => pathname)).toEqual([
			cardFront,
			cardBack,
			swept,
			plated,
		]);
	});

	it('records an image that holds no size, and skips a record whose images none could be read', async () => {
		const store = new InMemoryImageRecords([
			{
				kind: 'saved-draft',
				name: '0199d2a0-1b2c-7d3e-8f40-000000000003',
				id: '0199d2a0-1b2c-7d3e-8f40-000000000003',
				images: [{ pathname: corrupt }, { pathname: swept }],
			},
		]);

		const result = await backfillImageSizes(store, storedImageSizeReader(await storedImages()), {
			write: true,
		});

		expect(result.records[0]).toMatchObject({
			images: [
				{
					pathname: corrupt,
					reading: {
						kind: 'unreadable',
						message: expect.stringMatching(/^no image size: /),
					},
				},
				{ pathname: swept, reading: { kind: 'missing' } },
			],
			outcome: { kind: 'skipped', reason: 'unread' },
		});
		expect(store.imagesOf('0199d2a0-1b2c-7d3e-8f40-000000000003')).toEqual([
			{ pathname: corrupt },
			{ pathname: swept },
		]);
	});

	it('records an image whose read outlasts its 30 seconds, and carries on', async () => {
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
		const images = await storedImages();
		images.stallReads();
		const store = new InMemoryImageRecords([
			{
				kind: 'saved-draft',
				name: '0199d2a0-1b2c-7d3e-8f40-000000000003',
				id: '0199d2a0-1b2c-7d3e-8f40-000000000003',
				images: [{ pathname: plated }],
			},
		]);

		const run = backfillImageSizes(store, storedImageSizeReader(images), { write: true });
		const settled = vi.fn();
		void run.then(settled);
		await vi.advanceTimersByTimeAsync(30_000 - 1);
		expect(settled).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);

		expect((await run).records[0]?.images).toEqual([
			{
				pathname: plated,
				reading: { kind: 'unreadable', message: 'storage read failed: The operation timed out.' },
			},
		]);
	});

	it('reads a size as the image shows, with its orientation applied', async () => {
		const images = new InMemoryImageStore(folders);
		// Stored 48 wide and 32 high, and turned a quarter to show 32 wide and 48 high.
		await images.put(plated, await jpeg(48, 32, 6), 'image/jpeg');

		expect(await storedImageSizeReader(images)(plated)).toEqual({
			kind: 'sized',
			size: { width: 32, height: 48 },
		});
	});

	it('skips a record deleted during the run, and writes the others', async () => {
		const store = new DeletedDuringRunRecords(records());

		const result = await backfillImageSizes(store, storedImageSizeReader(await storedImages()), {
			write: true,
		});

		expect(result.records.map(({ kind, outcome }) => ({ kind, outcome }))).toEqual([
			{ kind: 'recipe', outcome: { kind: 'skipped', reason: 'changed' } },
			{ kind: 'import-draft', outcome: { kind: 'written' } },
			{ kind: 'saved-draft', outcome: { kind: 'written' } },
		]);
	});
});

describe('unsizedPathnames and withImageSizes', () => {
	it('names each stored image without a size once, and gives each its size', () => {
		const images: KeptImage[] = [
			{ pathname: plated, size: platedSize },
			{ pathname: cardFront },
			{},
			{ pathname: cardFront },
			{ pathname: cardBack },
		];
		const sizes = new Map([
			[cardFront, frontSize],
			[plated, { width: 1, height: 1 }],
		]);

		expect(unsizedPathnames(images)).toEqual([cardFront, cardBack]);
		expect(withImageSizes(images, sizes)).toEqual([
			{ pathname: plated, size: platedSize },
			{ pathname: cardFront, size: frontSize },
			{},
			{ pathname: cardFront, size: frontSize },
			{ pathname: cardBack },
		]);
	});
});

describe('DrizzleImageRecordStore', () => {
	const recipeImages: RecipeImage[] = [
		{ role: 'dish', pathname: plated, alt: 'Bars on a plate', size: platedSize },
		{ role: 'scan', pathname: cardFront },
		{ role: 'scan', pathname: cardBack },
	];

	function content(title: string, images: RecipeImage[]): RecipeContent {
		return {
			title,
			times: {},
			ingredientSections: [{ lines: [{ text: '2 eggs', amount: { min: 2 }, item: 'eggs' }] }],
			instructionSections: [{ steps: [{ text: 'Bake.' }] }],
			tags: ['Dessert'],
			images,
		};
	}

	// The recipe form's values as a saved draft keeps them, with a stored photo and one never stored.
	const draftValues = {
		text: { title: 'Lemon squares' },
		photos: {
			dish: [
				{ id: 3, fileName: 'IMG_0001.jpg', alt: '', pathname: plated },
				{ id: 4, fileName: 'IMG_0002.jpg', alt: '' },
			],
			scan: [{ id: 5, alt: '', pathname: cardBack, size: backSize }],
		},
		nextId: 6,
	};

	async function seeded(db: TestDatabase) {
		const member = await new DrizzleMemberRepository(db).create({
			email: 'contributor@example.com',
			displayName: 'Contributor',
			role: 'member',
		});
		const memberId: MemberId = member.id;
		const recipeRepository = new DrizzleRecipeRepository(db);
		const recipe = await recipeRepository.create({
			content: content('Lemon bars', recipeImages),
			provenance: { entryMode: 'manual' },
			contributorId: memberId,
			slugBase: 'lemon-bars',
		});
		// Every image sized, so nothing to backfill.
		await recipeRepository.create({
			content: content('Soy glaze', [{ role: 'dish', pathname: swept, size: platedSize }]),
			provenance: { entryMode: 'manual' },
			contributorId: memberId,
			slugBase: 'soy-glaze',
		});
		const importRepository = new DrizzleRecipeImportRepository(db);
		const started = await importRepository.start({ memberId, mode: 'photo' });
		if (started === null) {
			throw new Error('The import was refused');
		}
		await importRepository.recordSuccess(started.id, {
			draft: {
				content: { title: 'Lemon bars', images: [{ role: 'scan', pathname: cardFront }] },
				problems: [{ path: 'title', message: 'Check the title.' }],
			},
		});
		const [draft] = await db
			.insert(recipeDrafts)
			.values({ memberId, title: 'Lemon squares', values: draftValues, imagePathnames: [plated] })
			.returning({ id: recipeDrafts.id, updatedAt: recipeDrafts.updatedAt });
		if (draft === undefined) {
			throw new Error('The draft was not saved');
		}
		return { recipe, importId: started.id, draft };
	}

	it('lists the recipes, imports’ drafts, and saved drafts naming an image without a size', async () => {
		const db = await createTestDatabase();
		const { recipe, importId, draft } = await seeded(db);

		expect(await new DrizzleImageRecordStore(db).listUnsized()).toEqual([
			{
				kind: 'recipe',
				name: 'lemon-bars',
				id: recipe.id,
				title: 'Lemon bars',
				pathnames: [cardFront, cardBack],
			},
			{
				kind: 'import-draft',
				name: importId,
				id: importId,
				title: 'Lemon bars',
				pathnames: [cardFront],
			},
			{
				kind: 'saved-draft',
				name: draft.id,
				id: draft.id,
				title: 'Lemon squares',
				pathnames: [plated],
			},
		]);
	});

	it('writes each size into its record, keeping the rest of it and when it was saved', async () => {
		const db = await createTestDatabase();
		const { recipe, importId, draft } = await seeded(db);
		const store = new DrizzleImageRecordStore(db);
		const sizes = new Map([
			[plated, platedSize],
			[cardFront, frontSize],
			[cardBack, backSize],
		]);
		const written: number[] = [];

		for (const record of await store.listUnsized()) {
			written.push(await store.writeSizes(record, sizes));
		}

		expect(written).toEqual([2, 1, 1]);
		expect(await store.listUnsized()).toEqual([]);
		const [recipeRow] = await db
			.select({ content: recipes.content, updatedAt: recipes.updatedAt })
			.from(recipes)
			.where(eq(recipes.id, recipe.id));
		// The content column leaves the tags to a column of their own.
		const { tags, ...sizedContent } = content('Lemon bars', [
			{ role: 'dish', pathname: plated, alt: 'Bars on a plate', size: platedSize },
			{ role: 'scan', pathname: cardFront, size: frontSize },
			{ role: 'scan', pathname: cardBack, size: backSize },
		]);
		expect(tags).toEqual(['Dessert']);
		expect(recipeRow).toEqual({ content: sizedContent, updatedAt: recipe.updatedAt });
		expect(await new DrizzleRecipeRepository(db).findById(recipe.id)).toMatchObject({
			images: [
				{ pathname: plated, size: platedSize },
				{ pathname: cardFront, size: frontSize },
				{ pathname: cardBack, size: backSize },
			],
		});
		const [importRow] = await db
			.select({ draft: recipeImports.draft })
			.from(recipeImports)
			.where(eq(recipeImports.id, importId));
		expect(importRow?.draft).toEqual({
			content: {
				title: 'Lemon bars',
				images: [{ role: 'scan', pathname: cardFront, size: frontSize }],
			},
			problems: [{ path: 'title', message: 'Check the title.' }],
		});
		const [draftRow] = await db
			.select({ values: recipeDrafts.values, updatedAt: recipeDrafts.updatedAt })
			.from(recipeDrafts)
			.where(eq(recipeDrafts.id, draft.id));
		expect(draftRow).toEqual({
			values: {
				...draftValues,
				photos: {
					...draftValues.photos,
					dish: [
						{ id: 3, fileName: 'IMG_0001.jpg', alt: '', pathname: plated, size: platedSize },
						{ id: 4, fileName: 'IMG_0002.jpg', alt: '' },
					],
				},
			},
			updatedAt: draft.updatedAt,
		});
	});

	it('writes nothing to a record deleted since it was listed, and keeps an edit made since', async () => {
		const db = await createTestDatabase();
		const { recipe, importId } = await seeded(db);
		const store = new DrizzleImageRecordStore(db);
		const [listedRecipe, listedImport] = await store.listUnsized();
		await new DrizzleRecipeImportRepository(db).clearDraft(importId);
		await new DrizzleRecipeRepository(db).update(recipe.id, {
			content: content('Lemon bars', [{ role: 'scan', pathname: cardBack }]),
			expectedUpdatedAt: recipe.updatedAt,
		});
		const sizes = new Map([
			[cardFront, frontSize],
			[cardBack, backSize],
		]);

		expect(await store.writeSizes(listedImport!, sizes)).toBe(0);
		expect(await store.writeSizes(listedRecipe!, sizes)).toBe(1);
		expect((await new DrizzleRecipeRepository(db).findById(recipe.id))?.images).toEqual([
			{ role: 'scan', pathname: cardBack, size: backSize },
		]);
	});
});

describe('backfillReport', () => {
	it('shows each record’s images and the size read for each, and what a write would do', async () => {
		const result = await backfillImageSizes(
			new InMemoryImageRecords(records()),
			storedImageSizeReader(await storedImages()),
			{ write: false }
		);

		expect(backfillReport(result)).toBe(
			[
				'Found 3 records naming 5 images without a size.',
				[
					'recipe lemon-bars (Lemon bars): to write',
					`  ${cardFront}: 24 × 36`,
					`  ${cardBack}: 36 × 24`,
				].join('\n'),
				[
					'import draft 0199d2a0-1b2c-7d3e-8f40-000000000001: to write',
					`  ${cardFront}: 24 × 36`,
					`  ${swept}: not in storage, left without a size`,
				].join('\n'),
				[
					'saved draft 0199d2a0-1b2c-7d3e-8f40-000000000002 (Lemon squares): to write',
					`  ${plated}: 48 × 32`,
				].join('\n'),
				'Dry run: nothing was written. With --write, this run would write sizes into 3 records.',
				'1 image could not be read. One not in storage keeps no size: its photo shows as missing, and saving its recipe or draft asks for it to be added again. One that could not be read is read again by the next run.',
			].join('\n\n')
		);
	});

	it('says what was written, and to redeploy once a recipe changed', async () => {
		const result = await backfillImageSizes(
			new InMemoryImageRecords(records().slice(0, 1)),
			storedImageSizeReader(await storedImages()),
			{ write: true }
		);

		expect(backfillReport(result).split('\n\n').slice(-2)).toEqual([
			'Wrote sizes into 1 record.',
			'Cached recipe pages lay out their photos without the sizes until this environment is redeployed: redeploy it now.',
		]);
	});

	it('says a record skipped why', async () => {
		const result = await backfillImageSizes(
			new DeletedDuringRunRecords(records().slice(0, 1)),
			storedImageSizeReader(await storedImages()),
			{ write: true }
		);

		expect(backfillReport(result).split('\n\n')[1]?.split('\n')[0]).toBe(
			'recipe lemon-bars (Lemon bars): skipped, deleted or edited during the run'
		);
	});

	it('says there is nothing to change', async () => {
		const result = await backfillImageSizes(
			new InMemoryImageRecords([]),
			storedImageSizeReader(await storedImages()),
			{ write: true }
		);

		expect(backfillReport(result)).toBe(
			'Found 0 records naming 0 images without a size.\n\nNothing to change.'
		);
	});
});
