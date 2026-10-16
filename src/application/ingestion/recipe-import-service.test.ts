import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { SignInRequiredError } from '@/application/authorization';
import {
	ImportFailedError,
	ImportNoRecipeError,
	ImportPageRefusedError,
	ImportPageUnavailableError,
	ImportPausedError,
	ImportRateLimitedError,
	ImportTimedOutError,
	InvalidImportError,
} from '@/application/ingestion/errors';
import {
	RecipeImportService,
	type ScanUpload,
} from '@/application/ingestion/recipe-import-service';
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
import { InMemorySavedDraftRepository } from '@/application/testing/in-memory-saved-draft-repository';
import {
	importDraftFromExtractedRecipe,
	type ExtractedRecipe,
} from '@/domain/recipe/extracted-recipe';
import { parseRecipeContent } from '@/domain/recipe/recipe';
import type { RecipeImage } from '@/domain/recipe/recipe-image';
import type { RecipeImport, RecipeImportId } from '@/domain/recipe/recipe-import';
import { sampleTomatoSalad } from '@/domain/recipe/samples/sample-recipes';
import { daysInMilliseconds } from '@/lib/dates';
import { settings } from '@/lib/settings';

const folders = new ImageFolders('development');
const minuteInMilliseconds = 60 * 1000;
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
	reviewNotes: [{ field: 'title', note: 'Check the title. The card’s top edge is torn.' }],
};
const readCard: Extraction = { recipe: card, model: 'example/vision-model', costUsd: 0.012 };

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
const backOfCard = new Uint8Array([0xff, 0xd8, 0xff, 0x02, 0xd9]);
const scanPathname = 'scan/development/0b6e2f4a-9c1d-4e8b-a7f3-5d2c1b0a9e8f.jpg';
const secondScanPathname = 'scan/development/3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b.jpg';
const unstoredScanMessage = 'This photo didn’t upload. Remove it and add it again.';

type ImportFakes = {
	pages?: FixedWebPageFetcher;
	structuredData?: FixedPageRecipeExtractor;
	pageReader?: FixedPageRecipeExtractor;
	scanReader?: FixedScanRecipeExtractor;
};

// A portrait page as the browser draws one.
const pageSize = { width: 2304, height: 3072 };

function newScanPathname(): string {
	return `${folders.uploadFolder('scan')}${crypto.randomUUID()}.jpg`;
}

// The pages as the browser sends them, each drawn at the page size.
function uploadsOf(pathnames: readonly string[]): ScanUpload[] {
	return pathnames.map((pathname) => ({ pathname, size: pageSize }));
}

function scanImages(pathnames: readonly string[]): RecipeImage[] {
	return pathnames.map((pathname) => ({ role: 'scan', pathname, size: pageSize }));
}

// One store of imports, with a service per actor. By default the page has no structured data and
// the models read a recipe.
function createImports(fakes: ImportFakes = {}) {
	const recipes = new InMemoryRecipeRepository();
	const imports = new InMemoryRecipeImportRepository(recipes);
	const drafts = new InMemorySavedDraftRepository();
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
			drafts,
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
		imports.backdate(id, new Date(Date.now() - daysInMilliseconds(days)));
	return {
		recipes,
		imports,
		drafts,
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
	])('refuses %j with a problem on the address, before fetching it', async (address) => {
		const { pages, serviceFor } = createImports();

		const error = await failureOf(serviceFor(memberActor()).importFromUrl(address));

		expect(error).toBeInstanceOf(InvalidImportError);
		expect((error as InvalidImportError).problems).toEqual([
			{ path: 'url', message: invalidUrlMessage },
		]);
		expect(pages.fetchedUrls).toEqual([]);
	});

	it.each(['', '  '])('refuses a blank address %j, saying what to enter', async (address) => {
		const { pages, serviceFor } = createImports();

		const error = await failureOf(serviceFor(memberActor()).importFromUrl(address));

		expect(error).toBeInstanceOf(InvalidImportError);
		expect((error as InvalidImportError).problems).toEqual([
			{ path: 'url', message: 'Enter a link to the recipe.' },
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
	it('refuses a member past the daily limit, before fetching the page', async () => {
		const { pages, serviceFor, startImport } = createImports();
		const member = memberActor();
		for (let count = 0; count < settings.imports.maxImportsPerDay; count += 1) {
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
		for (let count = 0; count < settings.imports.maxImportsPerDay; count += 1) {
			backdate(await startImport(member), 1.01);
		}

		await expect(serviceFor(member).importFromUrl(url)).resolves.toBeDefined();
	});

	it("counts each member's imports alone", async () => {
		const { serviceFor, startImport } = createImports();
		const busyMember = memberActor();
		for (let count = 0; count < settings.imports.maxImportsPerDay; count += 1) {
			await startImport(busyMember);
		}

		await expect(serviceFor(memberActor()).importFromUrl(url)).resolves.toBeDefined();
	});

	it('leaves admins without a limit', async () => {
		const { serviceFor, startImport } = createImports();
		const admin = adminActor();
		for (let count = 0; count < settings.imports.maxImportsPerDay; count += 1) {
			await startImport(admin);
		}

		await expect(serviceFor(admin).importFromUrl(url)).resolves.toBeDefined();
	});
});

describe('expired drafts', () => {
	it('clears drafts past their lifetime, and their source URLs, before starting an import', async () => {
		const { imports, serviceFor, backdate } = createImports();
		const member = memberActor();
		const service = serviceFor(member);
		const expired = (await service.importFromUrl(url)).id;
		const recent = (await service.importFromUrl(url)).id;
		backdate(expired, settings.imports.importDraftLifetimeDays + 0.01);
		backdate(recent, settings.imports.importDraftLifetimeDays - 0.01);

		await service.importFromUrl(url);

		const expiredImport = await imports.findById(expired);
		expect(expiredImport).toMatchObject({ status: 'succeeded', aiModel: 'example/text-model' });
		expect(expiredImport).not.toHaveProperty('draft');
		expect(expiredImport).not.toHaveProperty('sourceUrl');
		expect(await imports.findById(recent)).toMatchObject({ sourceUrl: url });
		expect(logged('Expired import drafts cleared')).toMatchObject({ importCount: 1 });
	});

	it('deletes saved drafts past their lifetime before starting an import', async () => {
		const { drafts, serviceFor } = createImports();
		const member = memberActor();
		const saved = async () => {
			const draft = await drafts.create({
				memberId: member.memberId,
				values: {},
				imagePathnames: [],
			});
			if (draft === null) {
				throw new Error('The draft was refused');
			}
			return draft.id;
		};
		const expired = await saved();
		const recent = await saved();
		const lifetime = settings.drafts.savedDraftLifetimeDays;
		drafts.backdate(expired, new Date(Date.now() - daysInMilliseconds(lifetime + 0.01)));
		drafts.backdate(recent, new Date(Date.now() - daysInMilliseconds(lifetime - 0.01)));

		await serviceFor(member).importFromUrl(url);

		expect(await drafts.findById(expired)).toBeNull();
		expect(await drafts.findById(recent)).not.toBeNull();
		expect(logged('Expired saved drafts deleted')).toMatchObject({ draftCount: 1 });
	});
});

describe('interrupted imports', () => {
	it('settles imports still running 10 minutes after they started as failed, before starting an import', async () => {
		const { imports, serviceFor, startImport } = createImports();
		const member = memberActor();
		const interrupted = await startImport(member);
		const othersInterrupted = await startImport(memberActor());
		const running = await startImport(member);
		const leaseEnded = new Date(Date.now() - 10 * minuteInMilliseconds - 1);
		imports.backdate(interrupted, leaseEnded);
		imports.backdate(othersInterrupted, leaseEnded);
		imports.backdate(running, new Date(Date.now() - 9 * minuteInMilliseconds));

		await serviceFor(member).importFromUrl(url);

		for (const id of [interrupted, othersInterrupted]) {
			expect(await imports.findById(id)).toMatchObject({
				status: 'failed',
				failure: 'import.interrupted',
			});
		}
		expect(await imports.findById(running)).toMatchObject({ status: 'running' });
		expect(logged('Interrupted imports settled as failed')).toEqual({
			level: 'warn',
			logger: 'imports',
			message: 'Interrupted imports settled as failed',
			importCount: 2,
		});
	});
});

describe('import deadline', () => {
	beforeEach(() => {
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('fails a photo import whose scans never arrive after 110 seconds, before starting it', async () => {
		const { images, storeScans, scanReader, serviceFor, lastImport } = createImports();
		await storeScans([scanPathname]);
		images.stallReads();
		const reads = vi.spyOn(images, 'get');
		const member = memberActor();

		const failure = failureOf(serviceFor(member).importFromScans(uploadsOf([scanPathname])));
		const settled = vi.fn();
		failure.then(settled);
		await vi.advanceTimersByTimeAsync(110_000 - 1);
		expect(settled).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);

		const error = await failure;
		expect(error).toBeInstanceOf(ImportTimedOutError);
		expect((error as ImportTimedOutError).code).toBe('import.timed-out');
		expect(reads.mock.calls[0]?.[1]?.aborted).toBe(true);
		expect(scanReader.readScanSets).toEqual([]);
		await expect(lastImport()).rejects.toThrow('No import was started');
		expect(logged('Import timed out before it started')).toEqual({
			level: 'warn',
			logger: 'imports',
			message: 'Import timed out before it started',
			memberId: member.memberId,
			mode: 'photo',
		});
	});

	it('records an import whose model call passes the deadline as timed out, a problem to watch', async () => {
		const pageReader = new FixedPageRecipeExtractor(readLemonade);
		pageReader.stall();
		const reads = vi.spyOn(pageReader, 'extract');
		const { serviceFor, lastImport } = createImports({ pageReader });
		const member = memberActor();

		const failure = failureOf(serviceFor(member).importFromUrl(url));
		await vi.advanceTimersByTimeAsync(110_000);

		expect(await failure).toBeInstanceOf(ImportTimedOutError);
		expect(reads.mock.calls[0]?.[2]?.aborted).toBe(true);
		const recipeImport = await lastImport();
		expect(recipeImport).toMatchObject({ status: 'failed', failure: 'import.timed-out' });
		expect(logged('Import failed')).toEqual({
			level: 'warn',
			logger: 'imports',
			message: 'Import failed',
			importId: recipeImport.id,
			memberId: member.memberId,
			mode: 'url',
			failure: 'import.timed-out',
		});
	});

	it('bounds a database call, which takes no signal, by the same deadline', async () => {
		const { imports, serviceFor, lastImport } = createImports();
		vi.spyOn(imports, 'recordSuccess').mockReturnValue(new Promise(() => {}));

		const failure = failureOf(serviceFor(memberActor()).importFromUrl(url));
		await vi.advanceTimersByTimeAsync(110_000);

		expect(await failure).toBeInstanceOf(ImportTimedOutError);
		expect(await lastImport()).toMatchObject({ status: 'failed', failure: 'import.timed-out' });
	});

	it('answers as timed out 5 seconds after the deadline when recording it stalls, leaving it to the lease', async () => {
		const pageReader = new FixedPageRecipeExtractor(readLemonade);
		pageReader.stall();
		const { imports, serviceFor, lastImport } = createImports({ pageReader });
		vi.spyOn(imports, 'recordFailure').mockReturnValue(new Promise(() => {}));
		const member = memberActor();

		const failure = failureOf(serviceFor(member).importFromUrl(url));
		const settled = vi.fn();
		failure.then(settled);
		await vi.advanceTimersByTimeAsync(115_000 - 1);
		expect(settled).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);

		expect(await failure).toBeInstanceOf(ImportTimedOutError);
		const recipeImport = await lastImport();
		expect(recipeImport).toMatchObject({ status: 'running' });
		expect(logged('Import failure not recorded in time, so its lease settles it later')).toEqual({
			level: 'warn',
			logger: 'imports',
			message: 'Import failure not recorded in time, so its lease settles it later',
			importId: recipeImport.id,
			memberId: member.memberId,
			mode: 'url',
			failure: 'import.timed-out',
		});
	});

	it("answers with the import's own failure when recording it fails, logging that and leaving it to the lease", async () => {
		const pageReader = new FixedPageRecipeExtractor(readLemonade);
		pageReader.stall();
		const { imports, serviceFor, lastImport } = createImports({ pageReader });
		vi.spyOn(imports, 'recordFailure').mockRejectedValue(new Error('Database unreachable'));
		const member = memberActor();

		const failure = failureOf(serviceFor(member).importFromUrl(url));
		await vi.advanceTimersByTimeAsync(110_000);

		const error = await failure;
		expect(error).toBeInstanceOf(ImportTimedOutError);
		expect((error as ImportTimedOutError).code).toBe('import.timed-out');
		const recipeImport = await lastImport();
		expect(recipeImport).toMatchObject({ status: 'running' });
		expect(logged('Import failure not recorded, so its lease settles it later')).toEqual({
			level: 'error',
			logger: 'imports',
			message: 'Import failure not recorded, so its lease settles it later',
			importId: recipeImport.id,
			memberId: member.memberId,
			mode: 'url',
			failure: 'import.timed-out',
			err: expect.objectContaining({ message: 'Database unreachable' }),
		});
	});

	it('asks no model to read a page that arrives after the deadline', async () => {
		const { pages, pageReader, serviceFor } = createImports();
		vi.spyOn(pages, 'fetch').mockImplementation(
			() => new Promise((resolve) => setTimeout(() => resolve(page), 120_000))
		);

		const failure = failureOf(serviceFor(memberActor()).importFromUrl(url));
		await vi.advanceTimersByTimeAsync(120_000);

		expect(await failure).toBeInstanceOf(ImportTimedOutError);
		expect(pageReader.readPages).toEqual([]);
	});
});

describe('importFromScans', () => {
	it('refuses an anonymous visitor without reading the store', async () => {
		const { images, storeScans, serviceFor } = createImports();
		await storeScans([scanPathname]);

		await expect(
			serviceFor(anonymousActor()).importFromScans(uploadsOf([scanPathname]))
		).rejects.toThrow(SignInRequiredError);
		expect(images.wasRead).toBe(false);
	});

	it.each([
		['no photos', [], 'Add at least one photo.'],
		[
			'more photos than an import reads',
			Array.from({ length: settings.photos.maxScansPerImport + 1 }, newScanPathname),
			`Use ${settings.photos.maxScansPerImport} photos or fewer.`,
		],
	])('refuses %s with a problem on the list', async (_, pathnames, message) => {
		const { images, scanReader, serviceFor } = createImports();

		const error = await failureOf(serviceFor(memberActor()).importFromScans(uploadsOf(pathnames)));

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
				serviceFor(memberActor()).importFromScans(uploadsOf([scanPathname, pathname]))
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
			serviceFor(memberActor()).importFromScans(
				uploadsOf([scanPathname, secondScanPathname, scanPathname])
			)
		);

		expect((error as InvalidImportError).problems).toEqual([
			{ path: 'scans.2', message: 'This photo is already attached.' },
		]);
	});

	it('refuses a photo sent without its size, or past the longest side, without reading the store', async () => {
		const { images, storeScans, serviceFor } = createImports();
		const oversized = newScanPathname();
		await storeScans([scanPathname, secondScanPathname, oversized]);

		const error = await failureOf(
			serviceFor(memberActor()).importFromScans([
				{ pathname: scanPathname, size: pageSize },
				{ pathname: secondScanPathname },
				{ pathname: oversized, size: { width: 4032, height: 3024 } },
			])
		);

		expect((error as InvalidImportError).problems).toEqual([
			{
				path: 'scans.1',
				message: 'We couldn’t read this photo’s size. Remove it and add it again.',
			},
			{ path: 'scans.2', message: 'This photo is too large. Remove it and add it again.' },
		]);
		expect(images.wasRead).toBe(false);
	});

	it('refuses uploads that never finished, that are not JPEGs, or that are too large', async () => {
		const { images, storeScans, scanReader, serviceFor } = createImports();
		const notJpeg = newScanPathname();
		const tooLarge = newScanPathname();
		const largest = newScanPathname();
		await storeScans([scanPathname]);
		await images.put(notJpeg, jpeg, 'image/png');
		await storeScans([tooLarge], new Uint8Array(3_750_001));
		await storeScans([largest], new Uint8Array(3_750_000));

		const error = await failureOf(
			serviceFor(memberActor()).importFromScans(
				uploadsOf([scanPathname, secondScanPathname, notJpeg, tooLarge, largest])
			)
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
		await storeScans([scanPathname, secondScanPathname]);
		await nameScans(memberActor(), scanPathname, secondScanPathname);

		const error = await failureOf(
			serviceFor(memberActor()).importFromScans(uploadsOf([scanPathname, secondScanPathname]))
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
		await storeScans([scanPathname, secondScanPathname]);
		await nameScans(owner, scanPathname, secondScanPathname);

		await serviceFor(owner).importFromScans(uploadsOf([scanPathname, secondScanPathname]));

		expect(scanReader.readScanSets[0]).toHaveLength(2);
		expect(await lastImport()).toMatchObject({ status: 'succeeded' });
	});

	it('reads every photo in one call, in order, and keeps them on the draft as scans', async () => {
		const { images, scanReader, serviceFor, lastImport } = createImports();
		await images.put(scanPathname, jpeg, 'image/jpeg');
		await images.put(secondScanPathname, backOfCard, 'image/jpeg');

		await serviceFor(memberActor()).importFromScans(uploadsOf([scanPathname, secondScanPathname]));

		expect(scanReader.readScanSets).toEqual([
			[
				{ bytes: jpeg, mediaType: 'image/jpeg' },
				{ bytes: backOfCard, mediaType: 'image/jpeg' },
			],
		]);
		const expected = importDraftFromExtractedRecipe(
			card,
			scanImages([scanPathname, secondScanPathname])
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
		await storeScans([scanPathname]);

		await serviceFor(member).importFromScans(uploadsOf([scanPathname]));

		expect(scanReader.receivedRequesters).toEqual([{ memberId: member.memberId }]);
	});

	it('takes as many photos as an import reads', async () => {
		const { storeScans, scanReader, serviceFor } = createImports();
		const pathnames = Array.from({ length: settings.photos.maxScansPerImport }, newScanPathname);
		await storeScans(pathnames);

		await serviceFor(memberActor()).importFromScans(uploadsOf(pathnames));

		expect(scanReader.readScanSets[0]).toHaveLength(settings.photos.maxScansPerImport);
	});

	it('says there is no recipe when the photos hold none, and records what the call cost', async () => {
		const { storeScans, serviceFor, lastImport } = createImports({
			scanReader: new FixedScanRecipeExtractor(emptyReading),
		});
		await storeScans([scanPathname]);

		await expect(
			serviceFor(memberActor()).importFromScans(uploadsOf([scanPathname]))
		).rejects.toThrow(ImportNoRecipeError);
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
		await storeScans([scanPathname]);

		await expect(serviceFor(memberActor()).importFromScans(uploadsOf([scanPathname]))).rejects.toBe(
			error
		);
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
		await storeScans([scanPathname]);
		const service = serviceFor(memberActor());
		const { id } = await service.importFromScans(uploadsOf([scanPathname]));

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
