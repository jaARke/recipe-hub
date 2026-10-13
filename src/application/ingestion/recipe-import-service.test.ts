import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { SignInRequiredError } from '@/application/authorization';
import {
	ImportFailedError,
	ImportNoRecipeError,
	ImportPageRefusedError,
	ImportPageUnavailableError,
	ImportPausedError,
	ImportRateLimitedError,
	InvalidImportError,
} from '@/application/ingestion/errors';
import { RecipeImportService } from '@/application/ingestion/recipe-import-service';
import type { Actor, MemberActor } from '@/application/ports/actor-provider';
import type { Extraction } from '@/application/ports/recipe-extractors';
import type { WebPage } from '@/application/ports/web-page-fetcher';
import { ImageFolders } from '@/application/recipes/image-folders';
import { adminActor, anonymousActor, memberActor } from '@/application/testing/actors';
import { FixedActorProvider } from '@/application/testing/fixed-actor-provider';
import {
	FixedPageRecipeExtractor,
	FixedScanRecipeExtractor,
} from '@/application/testing/fixed-recipe-extractors';
import { FixedWebPageFetcher } from '@/application/testing/fixed-web-page-fetcher';
import { InMemoryImageStore } from '@/application/testing/in-memory-image-store';
import { InMemoryRecipeImportRepository } from '@/application/testing/in-memory-recipe-import-repository';
import { InMemoryRecipeRepository } from '@/application/testing/in-memory-recipe-repository';
import {
	importDraftFromExtractedRecipe,
	type ExtractedRecipe,
} from '@/domain/recipe/extracted-recipe';
import { parseRecipeContent } from '@/domain/recipe/recipe';
import type { RecipeImage } from '@/domain/recipe/recipe-image';
import type { RecipeImport, RecipeImportId } from '@/domain/recipe/recipe-import';
import { sampleTomatoSalad } from '@/domain/recipe/samples/sample-recipes';

const folders = new ImageFolders('development');
const dayInMilliseconds = 24 * 60 * 60 * 1000;
const missingId = '0199c7a4-2c3e-7b1a-9f00-2a7c1e4b5d6e';

const url = 'https://recipes.example.com/fresh-lemonade?ref=newsletter';
const invalidUrlMessage = 'Enter a web address that starts with http:// or https://.';

const page: WebPage = {
	url,
	html: '<!doctype html><html><body><h1>Fresh lemonade</h1></body></html>',
};

const lemonade: ExtractedRecipe = {
	title: 'Fresh lemonade',
	times: { prepMinutes: 10 },
	ingredientSections: [{ lines: ['1 cup sugar', '6 lemons'] }],
	instructionSections: [{ steps: ['Stir the sugar into the lemon juice.'] }],
	reviewNotes: [],
};

const emptyRecipe: ExtractedRecipe = {
	times: {},
	ingredientSections: [],
	instructionSections: [],
	reviewNotes: [],
};

// What a page's structured data gives, at no cost.
const structuredLemonade: Extraction = { recipe: lemonade };
// What a model reads from the page, and what the call cost.
const readLemonade: Extraction = { recipe: lemonade, model: 'example/text-model', costUsd: 0.0021 };
// A paid call that found no recipe.
const emptyReading: Extraction = {
	recipe: emptyRecipe,
	model: 'example/text-model',
	costUsd: 0.0009,
};

const card: ExtractedRecipe = {
	title: 'Lemon bars',
	source: 'Great-aunt Edie',
	times: {},
	ingredientSections: [{ lines: ['1 c. flour', '2 eggs'] }],
	instructionSections: [{ steps: ['Press crust into pan.'] }],
	reviewNotes: [{ field: 'title', note: "Check the title. The card's top edge is torn." }],
};
const readCard: Extraction = { recipe: card, model: 'example/vision-model', costUsd: 0.012 };

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
const backOfCard = new Uint8Array([0xff, 0xd8, 0xff, 0x02, 0xd9]);
const scanUpload = 'scan/development/0b6e2f4a-9c1d-4e8b-a7f3-5d2c1b0a9e8f.jpg';
const secondScanUpload = 'scan/development/3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b.jpg';
const unstoredScanMessage = "This photo didn't upload. Remove it and add it again.";

type ImportFakes = {
	pages?: FixedWebPageFetcher;
	structuredData?: FixedPageRecipeExtractor;
	pageReader?: FixedPageRecipeExtractor;
	scanReader?: FixedScanRecipeExtractor;
};

function newScanUpload(): string {
	return `${folders.uploadFolder('scan')}${crypto.randomUUID()}.jpg`;
}

function scanImages(pathnames: readonly string[]): RecipeImage[] {
	return pathnames.map((pathname) => ({ role: 'scan', pathname }));
}

// One store of imports, with a service per actor. By default the page has no structured data and
// the models read a recipe.
function createImports(fakes: ImportFakes = {}) {
	const recipes = new InMemoryRecipeRepository();
	const imports = new InMemoryRecipeImportRepository(recipes);
	const images = new InMemoryImageStore(folders);
	const pages = fakes.pages ?? new FixedWebPageFetcher(page);
	const structuredData = fakes.structuredData ?? new FixedPageRecipeExtractor(null);
	const pageReader = fakes.pageReader ?? new FixedPageRecipeExtractor(readLemonade);
	const scanReader = fakes.scanReader ?? new FixedScanRecipeExtractor(readCard);
	const starts = vi.spyOn(imports, 'start');

	const serviceFor = (actor: Actor) =>
		new RecipeImportService(
			recipes,
			imports,
			pages,
			structuredData,
			pageReader,
			scanReader,
			images,
			new FixedActorProvider(actor),
			folders
		);
	// The import the service started last, as the repository holds it now.
	const lastImport = async (): Promise<RecipeImport> => {
		const started = await starts.mock.results.at(-1)?.value;
		const stored = started === undefined ? null : await imports.findById(started.id);
		if (stored === null) {
			throw new Error('No import was started');
		}
		return stored;
	};
	const storeScans = async (pathnames: readonly string[], bytes = jpeg) => {
		for (const pathname of pathnames) {
			await images.put(pathname, bytes, 'image/jpeg');
		}
	};
	// The member's recipe lists one scan and their draft awaiting review names another.
	const nameScans = async (owner: MemberActor, recipeScan: string, draftScan: string) => {
		await recipes.create({
			content: parseRecipeContent({ ...sampleTomatoSalad, images: scanImages([recipeScan]) }),
			provenance: { entryMode: 'photo' },
			contributorId: owner.memberId,
			slugBase: 'tomato-salad',
		});
		const started = await imports.start({ memberId: owner.memberId, mode: 'photo' });
		if (started === null) {
			throw new Error('The import was refused');
		}
		await imports.recordSuccess(started.id, {
			draft: { content: { title: 'Lemon bars', images: scanImages([draftScan]) }, problems: [] },
		});
	};
	// An import the member started directly, as earlier requests leave them.
	const startImport = async (actor: MemberActor) => {
		const started = await imports.start({ memberId: actor.memberId, mode: 'url' });
		if (started === null) {
			throw new Error('The import was refused');
		}
		return started.id;
	};
	const backdate = (id: RecipeImportId, days: number) =>
		imports.backdate(id, new Date(Date.now() - days * dayInMilliseconds));
	return {
		recipes,
		imports,
		images,
		pages,
		structuredData,
		pageReader,
		scanReader,
		serviceFor,
		lastImport,
		storeScans,
		nameScans,
		startImport,
		backdate,
	};
}

async function failureOf(promise: Promise<unknown>): Promise<unknown> {
	return promise.then(
		() => {
			throw new Error('The import succeeded');
		},
		(error: unknown) => error
	);
}

let consoleInfo: MockInstance<typeof console.info>;
let consoleWarn: MockInstance<typeof console.warn>;
let consoleError: MockInstance<typeof console.error>;

function loggedCalls(): unknown[][] {
	return [...consoleInfo.mock.calls, ...consoleWarn.mock.calls, ...consoleError.mock.calls];
}

function loggedLines(): Record<string, unknown>[] {
	return loggedCalls().map(([line]) => JSON.parse(String(line)) as Record<string, unknown>);
}

function loggedText(): string {
	return loggedCalls()
		.map(([line]) => String(line))
		.join('\n');
}

function logged(message: string): Record<string, unknown> | undefined {
	return loggedLines().find((line) => line.message === message);
}

beforeEach(() => {
	// Keeps log lines out of the test output; the logging tests read them here.
	consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => {});
	consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('importFromUrl', () => {
	it('refuses an anonymous visitor before fetching anything', async () => {
		const { pages, serviceFor } = createImports();

		await expect(serviceFor(anonymousActor()).importFromUrl(url)).rejects.toThrow(
			SignInRequiredError
		);
		expect(pages.fetchedUrls).toEqual([]);
	});

	it.each([
		'recipes.example.com/lemonade',
		'ftp://recipes.example.com/lemonade',
		'javascript:alert(1)',
		'https://localhost/lemonade',
		'https://recipes.example.com/lemon\0ade',
		'',
	])('refuses %j with a problem on the address, before fetching it', async (address) => {
		const { pages, serviceFor } = createImports();

		const error = await failureOf(serviceFor(memberActor()).importFromUrl(address));

		expect(error).toBeInstanceOf(InvalidImportError);
		expect((error as InvalidImportError).problems).toEqual([
			{ path: 'url', message: invalidUrlMessage },
		]);
		expect(pages.fetchedUrls).toEqual([]);
	});

	it('uses complete structured data without calling the model', async () => {
		const { pageReader, serviceFor, lastImport } = createImports({
			structuredData: new FixedPageRecipeExtractor(structuredLemonade),
		});

		await serviceFor(memberActor()).importFromUrl(url);

		const recipeImport = await lastImport();
		expect(pageReader.readPages).toEqual([]);
		expect(recipeImport).toMatchObject({ status: 'succeeded', mode: 'url', sourceUrl: url });
		expect(recipeImport).not.toHaveProperty('aiModel');
		expect(recipeImport).not.toHaveProperty('costUsd');
		expect(recipeImport.draft?.content.title).toBe('Fresh lemonade');
	});

	it.each([
		['the page has no structured data', null],
		['the structured data has no title', { recipe: { ...lemonade, title: ' ' } }],
		['the structured data has no steps', { recipe: { ...lemonade, instructionSections: [] } }],
		[
			'the structured data has only blank ingredients',
			{ recipe: { ...lemonade, ingredientSections: [{ lines: [' '] }] } },
		],
	])('has the model read the page when %s', async (_, structured) => {
		const { pageReader, serviceFor, lastImport } = createImports({
			structuredData: new FixedPageRecipeExtractor(structured),
		});

		await serviceFor(memberActor()).importFromUrl(url);

		expect(pageReader.readPages).toEqual([page]);
		expect(await lastImport()).toMatchObject({
			status: 'succeeded',
			aiModel: 'example/text-model',
			costUsd: 0.0021,
		});
	});

	it('reads the page for the member, by their id alone', async () => {
		const { structuredData, pageReader, serviceFor } = createImports();
		const member = memberActor();

		await serviceFor(member).importFromUrl(url);

		const requester = { memberId: member.memberId };
		expect(structuredData.receivedRequesters).toEqual([requester]);
		expect(pageReader.receivedRequesters).toEqual([requester]);
	});

	it('stores the draft the domain builds from the reading, with the problems it found', async () => {
		const { serviceFor, lastImport } = createImports({
			pageReader: new FixedPageRecipeExtractor({
				...readLemonade,
				recipe: { ...lemonade, title: undefined },
			}),
		});

		await serviceFor(memberActor()).importFromUrl(url);

		const expected = importDraftFromExtractedRecipe({ ...lemonade, title: undefined }, []);
		expect((await lastImport()).draft).toEqual({
			content: expected.content,
			problems: expected.problems,
		});
		expect(expected.problems).toContainEqual(expect.objectContaining({ path: 'title' }));
	});

	it('fetches and records the address the member gave, not where the site redirected', async () => {
		const { pages, serviceFor, lastImport } = createImports({
			pages: new FixedWebPageFetcher({ ...page, url: 'https://www.example.com/lemonade-2' }),
		});

		await serviceFor(memberActor()).importFromUrl(`  ${url}\n`);

		expect(pages.fetchedUrls).toEqual([url]);
		expect((await lastImport()).sourceUrl).toBe(url);
	});

	it('returns the import, so the member can review its draft', async () => {
		const { serviceFor, lastImport } = createImports();

		const ref = await serviceFor(memberActor()).importFromUrl(url);

		expect(ref).toEqual({ id: (await lastImport()).id });
	});

	it.each([
		['the site refuses it', new ImportPageRefusedError(403), 'import.page-refused'],
		[
			'the page cannot be read',
			new ImportPageUnavailableError('timed-out'),
			'import.page-unavailable',
		],
	])('records a failed import when %s, without reading anything', async (_, error, failure) => {
		const { structuredData, pageReader, serviceFor, lastImport } = createImports({
			pages: new FixedWebPageFetcher(error),
		});

		await expect(serviceFor(memberActor()).importFromUrl(url)).rejects.toBe(error);

		expect(await lastImport()).toMatchObject({ status: 'failed', failure });
		expect(structuredData.readPages).toEqual([]);
		expect(pageReader.readPages).toEqual([]);
	});

	it.each([
		['the Gateway is out of credits', new ImportPausedError(), 'import.paused'],
		['the model call fails', new ImportFailedError(), 'import.failed'],
		['something unexpected breaks', new Error('Extractor crashed'), 'unexpected'],
	])('records a failed import when %s, and rethrows the error', async (_, error, failure) => {
		const { serviceFor, lastImport } = createImports({
			pageReader: new FixedPageRecipeExtractor(error),
		});

		await expect(serviceFor(memberActor()).importFromUrl(url)).rejects.toBe(error);

		const recipeImport = await lastImport();
		expect(recipeImport).toMatchObject({ status: 'failed', failure });
		expect(recipeImport).not.toHaveProperty('draft');
	});

	it.each([
		['found nothing', emptyReading],
		[
			'read only blank lines',
			{
				...emptyReading,
				recipe: {
					...emptyRecipe,
					ingredientSections: [{ lines: [''] }],
					instructionSections: [{ steps: ['\u0007 '] }],
				},
			},
		],
	])(
		'says there is no recipe when the model %s, and records what the call cost',
		async (_, reading) => {
			const { serviceFor, lastImport } = createImports({
				pageReader: new FixedPageRecipeExtractor(reading),
			});

			await expect(serviceFor(memberActor()).importFromUrl(url)).rejects.toThrow(
				ImportNoRecipeError
			);

			expect(await lastImport()).toMatchObject({
				status: 'failed',
				failure: 'import.no-recipe',
				costUsd: 0.0009,
			});
		}
	);

	it('keeps a reading with steps but no ingredients, for the member to finish', async () => {
		const { serviceFor, lastImport } = createImports({
			pageReader: new FixedPageRecipeExtractor({
				...readLemonade,
				recipe: { ...emptyRecipe, instructionSections: [{ steps: ['Stir the punch.'] }] },
			}),
		});

		await serviceFor(memberActor()).importFromUrl(url);

		expect(await lastImport()).toMatchObject({ status: 'succeeded' });
	});
});

describe('import limit', () => {
	it('refuses a member past 50 imports in a day, before fetching the page', async () => {
		const { pages, serviceFor, startImport } = createImports();
		const member = memberActor();
		for (let count = 0; count < 50; count += 1) {
			await startImport(member);
		}

		await expect(serviceFor(member).importFromUrl(url)).rejects.toThrow(ImportRateLimitedError);
		expect(pages.fetchedUrls).toEqual([]);
		expect(consoleWarn).toHaveBeenCalledOnce();
		expect(JSON.parse(String(consoleWarn.mock.calls[0]?.[0]))).toEqual({
			level: 'warn',
			logger: 'imports',
			message: 'Import refused at the daily limit',
			memberId: member.memberId,
			mode: 'url',
		});
	});

	it('counts only imports started in the last 24 hours', async () => {
		const { serviceFor, startImport, backdate } = createImports();
		const member = memberActor();
		for (let count = 0; count < 50; count += 1) {
			backdate(await startImport(member), 1.01);
		}

		await expect(serviceFor(member).importFromUrl(url)).resolves.toBeDefined();
	});

	it("counts each member's imports alone", async () => {
		const { serviceFor, startImport } = createImports();
		const busyMember = memberActor();
		for (let count = 0; count < 50; count += 1) {
			await startImport(busyMember);
		}

		await expect(serviceFor(memberActor()).importFromUrl(url)).resolves.toBeDefined();
	});

	it('leaves admins without a limit', async () => {
		const { serviceFor, startImport } = createImports();
		const admin = adminActor();
		for (let count = 0; count < 50; count += 1) {
			await startImport(admin);
		}

		await expect(serviceFor(admin).importFromUrl(url)).resolves.toBeDefined();
	});
});

describe('expired drafts', () => {
	it('clears drafts older than 7 days, and their source URLs, before starting an import', async () => {
		const { imports, serviceFor, backdate } = createImports();
		const member = memberActor();
		const service = serviceFor(member);
		const expired = (await service.importFromUrl(url)).id;
		const recent = (await service.importFromUrl(url)).id;
		backdate(expired, 7.01);
		backdate(recent, 6.99);

		await service.importFromUrl(url);

		const expiredImport = await imports.findById(expired);
		expect(expiredImport).toMatchObject({ status: 'succeeded', aiModel: 'example/text-model' });
		expect(expiredImport).not.toHaveProperty('draft');
		expect(expiredImport).not.toHaveProperty('sourceUrl');
		expect(await imports.findById(recent)).toMatchObject({ sourceUrl: url });
		expect(logged('Expired import drafts cleared')).toMatchObject({ importCount: 1 });
	});
});

describe('importFromScans', () => {
	it('refuses an anonymous visitor without reading the store', async () => {
		const { images, storeScans, serviceFor } = createImports();
		await storeScans([scanUpload]);

		await expect(serviceFor(anonymousActor()).importFromScans([scanUpload])).rejects.toThrow(
			SignInRequiredError
		);
		expect(images.wasRead).toBe(false);
	});

	it.each([
		['no photos', [], 'Add at least one photo.'],
		['more than 6 photos', Array.from({ length: 7 }, newScanUpload), 'Use 6 photos or fewer.'],
	])('refuses %s with a problem on the list', async (_, pathnames, message) => {
		const { images, scanReader, serviceFor } = createImports();

		const error = await failureOf(serviceFor(memberActor()).importFromScans(pathnames));

		expect(error).toBeInstanceOf(InvalidImportError);
		expect((error as InvalidImportError).problems).toEqual([{ path: 'scans', message }]);
		expect(images.wasRead).toBe(false);
		expect(scanReader.readScanSets).toEqual([]);
	});

	it.each([
		'dish/development/0b6e2f4a-9c1d-4e8b-a7f3-5d2c1b0a9e8f.jpg',
		'scan/production/0b6e2f4a-9c1d-4e8b-a7f3-5d2c1b0a9e8f.jpg',
		'scan/development/card.jpg',
		'scan/development/../development/0b6e2f4a-9c1d-4e8b-a7f3-5d2c1b0a9e8f.jpg',
	])(
		'refuses %s, which is not an upload to this scan folder, without reading the store',
		async (pathname) => {
			const { images, serviceFor } = createImports();

			const error = await failureOf(
				serviceFor(memberActor()).importFromScans([scanUpload, pathname])
			);

			expect((error as InvalidImportError).problems).toEqual([
				{ path: 'scans.1', message: unstoredScanMessage },
			]);
			expect(images.wasRead).toBe(false);
		}
	);

	it('refuses a photo listed twice', async () => {
		const { serviceFor } = createImports();

		const error = await failureOf(
			serviceFor(memberActor()).importFromScans([scanUpload, secondScanUpload, scanUpload])
		);

		expect((error as InvalidImportError).problems).toEqual([
			{ path: 'scans.2', message: 'This photo is already attached.' },
		]);
	});

	it('refuses uploads that never finished, that are not JPEGs, or that are too large', async () => {
		const { images, storeScans, scanReader, serviceFor } = createImports();
		const notJpeg = newScanUpload();
		const tooLarge = newScanUpload();
		const largest = newScanUpload();
		await storeScans([scanUpload]);
		await images.put(notJpeg, jpeg, 'image/png');
		await storeScans([tooLarge], new Uint8Array(3_750_001));
		await storeScans([largest], new Uint8Array(3_750_000));

		const error = await failureOf(
			serviceFor(memberActor()).importFromScans([
				scanUpload,
				secondScanUpload,
				notJpeg,
				tooLarge,
				largest,
			])
		);

		expect((error as InvalidImportError).problems).toEqual([
			{ path: 'scans.1', message: unstoredScanMessage },
			{ path: 'scans.2', message: unstoredScanMessage },
			{
				path: 'scans.3',
				message: 'This photo is too large to read. Crop it to the recipe and add it again.',
			},
		]);
		expect(scanReader.readScanSets).toEqual([]);
	});

	it("refuses scans another member's recipe or draft names as never uploaded, without reading the store", async () => {
		const { images, storeScans, nameScans, scanReader, serviceFor } = createImports();
		await storeScans([scanUpload, secondScanUpload]);
		await nameScans(memberActor(), scanUpload, secondScanUpload);

		const error = await failureOf(
			serviceFor(memberActor()).importFromScans([scanUpload, secondScanUpload])
		);

		expect((error as InvalidImportError).problems).toEqual([
			{ path: 'scans.0', message: unstoredScanMessage },
			{ path: 'scans.1', message: unstoredScanMessage },
		]);
		expect(images.wasRead).toBe(false);
		expect(scanReader.readScanSets).toEqual([]);
	});

	it("imports the member's own scans again, from their recipe or a draft", async () => {
		const { storeScans, nameScans, scanReader, serviceFor, lastImport } = createImports();
		const owner = memberActor();
		await storeScans([scanUpload, secondScanUpload]);
		await nameScans(owner, scanUpload, secondScanUpload);

		await serviceFor(owner).importFromScans([scanUpload, secondScanUpload]);

		expect(scanReader.readScanSets[0]).toHaveLength(2);
		expect(await lastImport()).toMatchObject({ status: 'succeeded' });
	});

	it('reads every photo in one call, in order, and keeps them on the draft as scans', async () => {
		const { images, scanReader, serviceFor, lastImport } = createImports();
		await images.put(scanUpload, jpeg, 'image/jpeg');
		await images.put(secondScanUpload, backOfCard, 'image/jpeg');

		await serviceFor(memberActor()).importFromScans([scanUpload, secondScanUpload]);

		expect(scanReader.readScanSets).toEqual([
			[
				{ bytes: jpeg, mediaType: 'image/jpeg' },
				{ bytes: backOfCard, mediaType: 'image/jpeg' },
			],
		]);
		const expected = importDraftFromExtractedRecipe(
			card,
			scanImages([scanUpload, secondScanUpload])
		);
		const recipeImport = await lastImport();
		expect(recipeImport).toMatchObject({
			mode: 'photo',
			status: 'succeeded',
			aiModel: 'example/vision-model',
			costUsd: 0.012,
		});
		expect(recipeImport).not.toHaveProperty('sourceUrl');
		expect(recipeImport.draft).toEqual({ content: expected.content, problems: expected.problems });
	});

	it('reads the photos for the member, by their id alone', async () => {
		const { storeScans, scanReader, serviceFor } = createImports();
		const member = memberActor();
		await storeScans([scanUpload]);

		await serviceFor(member).importFromScans([scanUpload]);

		expect(scanReader.receivedRequesters).toEqual([{ memberId: member.memberId }]);
	});

	it('takes up to 6 photos', async () => {
		const { storeScans, scanReader, serviceFor } = createImports();
		const pathnames = Array.from({ length: 6 }, newScanUpload);
		await storeScans(pathnames);

		await serviceFor(memberActor()).importFromScans(pathnames);

		expect(scanReader.readScanSets[0]).toHaveLength(6);
	});

	it('says there is no recipe when the photos hold none, and records what the call cost', async () => {
		const { storeScans, serviceFor, lastImport } = createImports({
			scanReader: new FixedScanRecipeExtractor(emptyReading),
		});
		await storeScans([scanUpload]);

		await expect(serviceFor(memberActor()).importFromScans([scanUpload])).rejects.toThrow(
			ImportNoRecipeError
		);
		expect(await lastImport()).toMatchObject({
			mode: 'photo',
			status: 'failed',
			failure: 'import.no-recipe',
			costUsd: 0.0009,
		});
	});

	it('records a failed model call and rethrows it', async () => {
		const error = new ImportPausedError();
		const { storeScans, serviceFor, lastImport } = createImports({
			scanReader: new FixedScanRecipeExtractor(error),
		});
		await storeScans([scanUpload]);

		await expect(serviceFor(memberActor()).importFromScans([scanUpload])).rejects.toBe(error);
		expect(await lastImport()).toMatchObject({ status: 'failed', failure: 'import.paused' });
	});
});

describe('getImportReview', () => {
	it('refuses an anonymous visitor', async () => {
		const { serviceFor } = createImports();

		await expect(serviceFor(anonymousActor()).getImportReview(missingId)).rejects.toThrow(
			SignInRequiredError
		);
	});

	it('returns the draft to the member who imported it, with the page it was read from', async () => {
		const { serviceFor } = createImports();
		const service = serviceFor(memberActor());
		const { id } = await service.importFromUrl(url);

		const review = await service.getImportReview(id);

		const expected = importDraftFromExtractedRecipe(lemonade, []);
		expect(review).toEqual({
			status: 'reviewable',
			draft: {
				id,
				mode: 'url',
				sourceUrl: url,
				content: expected.content,
				problems: expected.problems,
			},
		});
	});

	it('returns a photo import without a source URL', async () => {
		const { storeScans, serviceFor } = createImports();
		await storeScans([scanUpload]);
		const service = serviceFor(memberActor());
		const { id } = await service.importFromScans([scanUpload]);

		const review = await service.getImportReview(id);

		expect(review).toMatchObject({ status: 'reviewable', draft: { id, mode: 'photo' } });
		expect(review?.status === 'reviewable' && review.draft).not.toHaveProperty('sourceUrl');
	});

	it('names the recipe saved from the import, after its draft is cleared', async () => {
		const { recipes, imports, serviceFor } = createImports();
		const member = memberActor();
		const service = serviceFor(member);
		const { id } = await service.importFromUrl(url);
		const recipe = await recipes.create({
			content: parseRecipeContent(sampleTomatoSalad),
			provenance: { entryMode: 'url', sourceUrl: url },
			importId: id,
			contributorId: member.memberId,
			slugBase: 'tomato-salad',
		});
		await imports.clearDraft(id);

		expect(await service.getImportReview(id)).toEqual({
			status: 'saved',
			recipeSlug: recipe.slug,
		});
	});

	it.each(['not-an-import-id', missingId])('returns null for %s', async (id) => {
		const { serviceFor } = createImports();

		expect(await serviceFor(memberActor()).getImportReview(id)).toBeNull();
	});

	it("returns null for another member's import, even to an admin", async () => {
		const { serviceFor } = createImports();
		const { id } = await serviceFor(memberActor()).importFromUrl(url);

		expect(await serviceFor(memberActor()).getImportReview(id)).toBeNull();
		expect(await serviceFor(adminActor()).getImportReview(id)).toBeNull();
	});

	it('returns null for a failed import', async () => {
		const { serviceFor, lastImport } = createImports({
			pageReader: new FixedPageRecipeExtractor(emptyReading),
		});
		const service = serviceFor(memberActor());
		await service.importFromUrl(url).catch(() => undefined);

		expect(await service.getImportReview((await lastImport()).id)).toBeNull();
	});

	it('returns null for a draft that expired or was cleared without a recipe', async () => {
		const { imports, serviceFor, backdate } = createImports();
		const service = serviceFor(memberActor());
		const expired = (await service.importFromUrl(url)).id;
		const cleared = (await service.importFromUrl(url)).id;
		backdate(expired, 7.01);
		await imports.clearDraft(cleared);

		expect(await service.getImportReview(expired)).toBeNull();
		expect(await service.getImportReview(cleared)).toBeNull();
	});
});

describe('listUnsavedImports', () => {
	it('refuses an anonymous visitor', async () => {
		const { serviceFor } = createImports();

		await expect(serviceFor(anonymousActor()).listUnsavedImports()).rejects.toThrow(
			SignInRequiredError
		);
	});

	it("lists the member's reviewable drafts, newest first", async () => {
		const { recipes, storeScans, serviceFor, backdate } = createImports();
		await storeScans([scanUpload]);
		const member = memberActor();
		const service = serviceFor(member);
		const first = (await service.importFromUrl(url)).id;
		const photo = (await service.importFromScans([scanUpload])).id;
		const saved = (await service.importFromUrl(url)).id;
		const expired = (await service.importFromUrl(url)).id;
		await serviceFor(memberActor()).importFromUrl(url);
		await recipes.create({
			content: parseRecipeContent(sampleTomatoSalad),
			provenance: { entryMode: 'manual' },
			importId: saved,
			contributorId: member.memberId,
			slugBase: 'tomato-salad',
		});
		backdate(expired, 7.01);

		const unsaved = await service.listUnsavedImports();

		expect(unsaved).toEqual([
			{ id: photo, mode: 'photo', title: 'Lemon bars', createdAt: expect.any(Date) },
			{ id: first, mode: 'url', title: 'Fresh lemonade', createdAt: expect.any(Date) },
		]);
	});

	it('lists at most the 10 newest', async () => {
		const { serviceFor } = createImports();
		const service = serviceFor(memberActor());
		const ids: RecipeImportId[] = [];
		for (let count = 0; count < 11; count += 1) {
			ids.push((await service.importFromUrl(url)).id);
		}

		const unsaved = await service.listUnsavedImports();

		expect(unsaved.map(({ id }) => id)).toEqual(ids.slice(1).reverse());
	});
});

describe('logging', () => {
	it('logs an import by ids, mode, model, and cost, never the address, email, or recipe', async () => {
		const { serviceFor } = createImports();
		const member = memberActor();

		const { id } = await serviceFor(member).importFromUrl(url);

		expect(logged('Import started')).toEqual({
			level: 'info',
			logger: 'imports',
			message: 'Import started',
			importId: id,
			memberId: member.memberId,
			mode: 'url',
		});
		expect(logged('Import finished')).toEqual({
			level: 'info',
			logger: 'imports',
			message: 'Import finished',
			importId: id,
			memberId: member.memberId,
			mode: 'url',
			aiModel: 'example/text-model',
			costUsd: 0.0021,
		});
		expect(loggedText()).not.toMatch(/example\.com|newsletter|lemonade|sugar/i);
	});

	it.each([
		[new ImportPageRefusedError(451), { status: 451 }],
		[new ImportPageUnavailableError('not-html'), { reason: 'not-html' }],
	])('logs a page that could not be read with why, never the address', async (error, why) => {
		const { serviceFor, lastImport } = createImports({
			pages: new FixedWebPageFetcher(error),
		});
		const member = memberActor();

		await serviceFor(member)
			.importFromUrl(url)
			.catch(() => undefined);

		expect(logged('Import failed')).toEqual({
			level: 'info',
			logger: 'imports',
			message: 'Import failed',
			importId: (await lastImport()).id,
			memberId: member.memberId,
			mode: 'url',
			failure: error.code,
			...why,
		});
		expect(loggedText()).not.toMatch(/example\.com|newsletter/);
	});

	it.each<[string, ImportFakes, 'info' | 'warn' | 'error']>([
		[
			'a page that refused',
			{ pages: new FixedWebPageFetcher(new ImportPageRefusedError(403)) },
			'info',
		],
		[
			'a page that could not be read',
			{ pages: new FixedWebPageFetcher(new ImportPageUnavailableError('timed-out')) },
			'info',
		],
		[
			'a reading with no recipe',
			{ pageReader: new FixedPageRecipeExtractor(emptyReading) },
			'info',
		],
		[
			'a paused import',
			{ pageReader: new FixedPageRecipeExtractor(new ImportPausedError()) },
			'warn',
		],
		[
			'a failed model call',
			{ pageReader: new FixedPageRecipeExtractor(new ImportFailedError()) },
			'warn',
		],
		[
			'an unexpected failure',
			{ pageReader: new FixedPageRecipeExtractor(new Error('Extractor crashed')) },
			'error',
		],
	])('logs %s at %s', async (_, fakes, level) => {
		const { serviceFor } = createImports(fakes);
		const consoleMethod = { info: consoleInfo, warn: consoleWarn, error: consoleError }[level];

		await serviceFor(memberActor())
			.importFromUrl(url)
			.catch(() => undefined);

		expect(logged('Import failed')).toMatchObject({ level });
		expect(consoleMethod.mock.calls.map(([line]) => JSON.parse(String(line)).message)).toContain(
			'Import failed'
		);
	});

	it('logs the model and cost of a paid call that found no recipe', async () => {
		const { serviceFor } = createImports({
			pageReader: new FixedPageRecipeExtractor(emptyReading),
		});

		await serviceFor(memberActor())
			.importFromUrl(url)
			.catch(() => undefined);

		expect(logged('Import failed')).toMatchObject({
			failure: 'import.no-recipe',
			aiModel: 'example/text-model',
			costUsd: 0.0009,
		});
		expect(logged('Import failed')).not.toHaveProperty('err');
	});

	it('logs paused imports by their code alone', async () => {
		const { serviceFor } = createImports({
			pageReader: new FixedPageRecipeExtractor(
				new ImportPausedError({ cause: { statusCode: 402 } })
			),
		});

		await serviceFor(memberActor())
			.importFromUrl(url)
			.catch(() => undefined);

		expect(logged('Import failed')).toMatchObject({ failure: 'import.paused' });
		expect(logged('Import failed')).not.toHaveProperty('err');
	});

	it.each([
		[
			'a failed model call, with its cause',
			new ImportFailedError({ cause: { statusCode: 500, generationId: 'gen_01' } }),
			'import.failed',
			{ code: 'import.failed', cause: { statusCode: 500, generationId: 'gen_01' } },
		],
		[
			'an unexpected failure',
			new Error('Extractor crashed'),
			'unexpected',
			{ message: 'Extractor crashed' },
		],
	])('logs the error of %s', async (_, error, failure, loggedError) => {
		const { serviceFor } = createImports({
			pageReader: new FixedPageRecipeExtractor(error),
		});

		await serviceFor(memberActor())
			.importFromUrl(url)
			.catch(() => undefined);

		expect(logged('Import failed')).toMatchObject({
			failure,
			err: { ...loggedError, stack: expect.any(String) },
		});
	});
});
