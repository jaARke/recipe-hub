import 'server-only';
import { z } from 'zod';
import { requireMember } from '@/application/authorization';
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
	toImportDraftDto,
	type ImportReviewDto,
	type RecipeImportRef,
	type UnsavedImportDto,
} from '@/application/ingestion/recipe-import-dtos';
import type { ActorProvider, MemberActor } from '@/application/ports/actor-provider';
import type { ImageStore } from '@/application/ports/image-store';
import type {
	Extraction,
	ExtractionRequester,
	PageRecipeExtractor,
	ScanImage,
	ScanRecipeExtractor,
} from '@/application/ports/recipe-extractors';
import type {
	RecipeImportLimit,
	RecipeImportRepository,
} from '@/application/ports/recipe-import-repository';
import type { RecipeRepository } from '@/application/ports/recipe-repository';
import type { WebPage, WebPageFetcher } from '@/application/ports/web-page-fetcher';
import type { ImageFolders } from '@/application/recipes/image-folders';
import { imagesInUse } from '@/application/recipes/images-in-use';
import type { MemberId } from '@/domain/member/member';
import {
	importDraftFromExtractedRecipe,
	type ExtractedRecipe,
} from '@/domain/recipe/extracted-recipe';
import { maxImportScanSizeInBytes } from '@/domain/recipe/import-limits';
import type { RecipeImage } from '@/domain/recipe/recipe-image';
import {
	importDraftCutoff,
	recipeImportIdSchema,
	reviewableDraft,
	type RecipeImport,
	type RecipeImportMode,
} from '@/domain/recipe/recipe-import';
import { hasNoNul, nonEmptyTextSchema } from '@/domain/text';
import { daysInMilliseconds } from '@/lib/dates';
import { deadlineAfter, settleWithin } from '@/lib/deadline';
import { AppError } from '@/lib/errors';
import { getLogger } from '@/lib/logger';
import { settings } from '@/lib/settings';

// Bounds an import from its first step. It outlasts the slowest import that can still succeed, a
// 10-second page fetch then a model call, which the settings schema keeps within 100 seconds, and
// ends 10 seconds before the contribute page's maxDuration of 120 seconds, which leaves time to
// record the failure.
const importTimeLimitMs = 110 * 1000;

// Bounds recording a failure, which starts by the import's time limit of 110 seconds, so the member
// hears of the failure before the contribute page's maxDuration of 120 seconds ends the function.
const failureRecordingTimeLimitMs = 5 * 1000;

// An import whose function ended before it recorded the outcome stays running. One still running this
// long after it started is settled as failed; the contribute page's maxDuration of 120 seconds has
// ended its function long before.
const importLeaseMs = 10 * 60 * 1000;

// The browser re-encodes every scan as a JPEG before uploading it.
const scanMediaType = 'image/jpeg' satisfies ScanImage['mediaType'];

// As provenance stores a source URL: http or https and a named host, without the NUL character
// that Postgres text cannot hold.
const importUrlSchema = z.httpUrl().refine(hasNoNul);

const invalidUrlMessage = 'Enter a web address that starts with http:// or https://.';
const noScansMessage = 'Add at least one photo.';
const tooManyScansMessage = `Use ${settings.photos.maxScansPerImport} photos or fewer.`;
// For a scan this environment never stored: its upload failed, was cut off, or never happened. A scan
// another member's recipe or draft names gets it too, so the refusal tells nothing about theirs.
const unstoredScanMessage = 'This photo didn’t upload. Remove it and add it again.';
const repeatedScanMessage = 'This photo is already attached.';
const largeScanMessage = 'This photo is too large to read. Crop it to the recipe and add it again.';

// Recorded for a failure that is not an expected error, which would carry a code.
const unexpectedFailure = 'unexpected';
// Recorded for an import still running past its lease. No member sees it, as no form is waiting.
const interruptedFailure = 'import.interrupted';

const logger = getLogger('imports');

// Recording a failure outlasted failureRecordingTimeLimitMs.
class FailureRecordingTimedOutError extends Error {}

// What an import reads: the page at the address the member gave, or their scans, which stay
// attached to the recipe.
type ImportSource =
	{ mode: 'url'; sourceUrl: string } | { mode: 'photo'; images: readonly RecipeImage[] };

// What a timeout before the import is recorded logs: its mode, and its member once known.
type UnrecordedImport = {
	memberId?: MemberId;
	mode: RecipeImportMode;
};

// Text the draft keeps: anything but blanks and control characters.
function hasText(text: string | undefined): boolean {
	return text !== undefined && nonEmptyTextSchema.safeParse(text).success;
}

function hasIngredients(recipe: ExtractedRecipe): boolean {
	return recipe.ingredientSections.some(({ lines }) => lines.some(hasText));
}

function hasSteps(recipe: ExtractedRecipe): boolean {
	return recipe.instructionSections.some(({ steps }) => steps.some(hasText));
}

// A reading with neither an ingredient nor a step found no recipe.
function foundRecipe(recipe: ExtractedRecipe): boolean {
	return hasIngredients(recipe) || hasSteps(recipe);
}

// Everything a recipe needs. Structured data that lacks any of it leaves the page to a model.
function isComplete(recipe: ExtractedRecipe): boolean {
	return hasText(recipe.title) && hasIngredients(recipe) && hasSteps(recipe);
}

// Addresses arrive from forms. A malformed one gets the field's message.
function importUrl(url: string): string {
	const result = importUrlSchema.safeParse(url);
	if (!result.success) {
		throw new InvalidImportError([{ path: 'url', message: invalidUrlMessage }]);
	}

	return result.data;
}

function importLimit(actor: MemberActor, now: Date): RecipeImportLimit | undefined {
	return actor.role === 'admin'
		? undefined
		: {
				maxImports: settings.imports.maxImportsPerDay,
				since: new Date(now.getTime() - daysInMilliseconds(1)),
			};
}

// An expected failure's code says what happened. An unexpected one keeps its stack, and a failed
// model call its cause, which holds the call's status, finish reason, and generation id.
function logsError(error: unknown): boolean {
	return !(error instanceof AppError) || error instanceof ImportFailedError;
}

// Waits on one step of an import, which fails as timed out once the import's deadline passes. A
// step given the deadline's signal stops then too; any other step is left behind.
function withinImport<T>(step: Promise<T>, deadline: AbortSignal): Promise<T> {
	return settleWithin(step, { deadline }, () => new ImportTimedOutError());
}

// Each message is the problem with the scan at its index, if it has one.
function assertNoScanProblems(messages: readonly (string | undefined)[]): void {
	const problems = messages.flatMap((message, index) =>
		message === undefined ? [] : [{ path: `scans.${index}`, message }]
	);
	if (problems.length > 0) {
		throw new InvalidImportError(problems);
	}
}

function scanContentProblem(scan: ScanImage | null): string | undefined {
	if (scan === null) {
		return unstoredScanMessage;
	}

	return scan.bytes.byteLength > maxImportScanSizeInBytes ? largeScanMessage : undefined;
}

export class RecipeImportService {
	private readonly recipes: RecipeRepository;
	private readonly imports: RecipeImportRepository;
	private readonly pages: WebPageFetcher;
	private readonly structuredData: PageRecipeExtractor;
	private readonly pageReader: PageRecipeExtractor;
	private readonly scanReader: ScanRecipeExtractor;
	private readonly images: ImageStore;
	private readonly actors: ActorProvider;
	private readonly folders: ImageFolders;

	// A page is read from its structured data, which costs nothing, or by the page reader's model.
	constructor(
		recipes: RecipeRepository,
		imports: RecipeImportRepository,
		pages: WebPageFetcher,
		structuredData: PageRecipeExtractor,
		pageReader: PageRecipeExtractor,
		scanReader: ScanRecipeExtractor,
		images: ImageStore,
		actors: ActorProvider,
		folders: ImageFolders
	) {
		this.recipes = recipes;
		this.imports = imports;
		this.pages = pages;
		this.structuredData = structuredData;
		this.pageReader = pageReader;
		this.scanReader = scanReader;
		this.images = images;
		this.actors = actors;
		this.folders = folders;
	}

	// The recipe's source is the address the member gave, not wherever the site redirects it: that is
	// the page they know, and the domain's provenance accepts it.
	async importFromUrl(url: string): Promise<RecipeImportRef> {
		const deadline = deadlineAfter(importTimeLimitMs);
		const actor = requireMember(
			await this.beforeStart(this.actors.currentActor(), deadline, { mode: 'url' })
		);
		const sourceUrl = importUrl(url);
		return this.runImport(actor, { mode: 'url', sourceUrl }, deadline, async (requester) =>
			this.extractFromPage(await this.pages.fetch(sourceUrl, deadline), requester, deadline)
		);
	}

	// Every page goes to the model in one call, so a recipe that runs onto the back of a card stays one
	// recipe. Pathnames are the browser's upload names, in page order.
	async importFromScans(pathnames: readonly string[]): Promise<RecipeImportRef> {
		const deadline = deadlineAfter(importTimeLimitMs);
		const actor = requireMember(
			await this.beforeStart(this.actors.currentActor(), deadline, { mode: 'photo' })
		);
		const scans = await this.beforeStart(
			this.readScans(pathnames, actor.memberId, deadline),
			deadline,
			{ memberId: actor.memberId, mode: 'photo' }
		);
		const images = pathnames.map((pathname): RecipeImage => ({ role: 'scan', pathname }));
		return this.runImport(actor, { mode: 'photo', images }, deadline, (requester) =>
			this.scanReader.extract(scans, requester, deadline)
		);
	}

	// Null for an import that is not the member's, failed, or whose draft expired or was cleared
	// without a recipe. Ids arrive from URLs, so a malformed id names no import.
	async getImportReview(id: string): Promise<ImportReviewDto | null> {
		const actor = requireMember(await this.actors.currentActor());
		const parsed = recipeImportIdSchema.safeParse(id);
		const recipeImport = parsed.success ? await this.imports.findById(parsed.data) : null;
		if (recipeImport === null || recipeImport.memberId !== actor.memberId) {
			return null;
		}

		if (recipeImport.savedRecipeSlug !== undefined) {
			return { status: 'saved', recipeSlug: recipeImport.savedRecipeSlug };
		}

		const draft = reviewableDraft(recipeImport, new Date());
		if (draft === null) {
			return null;
		}

		return { status: 'reviewable', draft: toImportDraftDto(recipeImport, draft) };
	}

	// The member's drafts that have not expired, newest first.
	async listUnsavedImports(): Promise<UnsavedImportDto[]> {
		const actor = requireMember(await this.actors.currentActor());
		return this.imports.listUnsaved(
			actor.memberId,
			importDraftCutoff(new Date()),
			settings.imports.maxUnsavedImports
		);
	}

	// Every outcome of a started import is recorded, with what the model calls cost. Recording a failure
	// waits past the deadline, for a bound of its own that ends before the function does.
	private async runImport(
		actor: MemberActor,
		source: ImportSource,
		deadline: AbortSignal,
		extract: (requester: ExtractionRequester) => Promise<Extraction | null>
	): Promise<RecipeImportRef> {
		const recipeImport = await this.beforeStart(this.startImport(actor, source.mode), deadline, {
			memberId: actor.memberId,
			mode: source.mode,
		});
		let extraction: Extraction | null = null;
		try {
			extraction = await withinImport(extract({ memberId: actor.memberId }), deadline);
			if (extraction === null || !foundRecipe(extraction.recipe)) {
				throw new ImportNoRecipeError();
			}

			await withinImport(this.recordDraft(recipeImport, source, extraction), deadline);
		} catch (error) {
			await this.recordFailure(recipeImport, error, extraction);
			throw error;
		}

		return { id: recipeImport.id };
	}

	// A step before the import is recorded. No record will keep a timeout here, so it is logged.
	private async beforeStart<T>(
		step: Promise<T>,
		deadline: AbortSignal,
		unrecorded: UnrecordedImport
	): Promise<T> {
		try {
			return await withinImport(step, deadline);
		} catch (error) {
			if (error instanceof ImportTimedOutError) {
				logger.warn('Import timed out before it started', unrecorded);
			}
			throw error;
		}
	}

	// The repository counts the member's recent imports and starts this one under one lock.
	private async startImport(actor: MemberActor, mode: RecipeImportMode): Promise<RecipeImport> {
		await this.clearExpiredDrafts();
		await this.settleInterruptedImports();
		const recipeImport = await this.imports.start(
			{ memberId: actor.memberId, mode },
			importLimit(actor, new Date())
		);
		if (recipeImport === null) {
			logger.warn('Import refused at the daily limit', { memberId: actor.memberId, mode });
			throw new ImportRateLimitedError();
		}

		logger.info('Import started', {
			importId: recipeImport.id,
			memberId: recipeImport.memberId,
			mode: recipeImport.mode,
		});
		return recipeImport;
	}

	// Drafts are cleared lazily, before each import, so no scheduled job is needed.
	private async clearExpiredDrafts(): Promise<void> {
		const cleared = await this.imports.clearDraftsCreatedBefore(importDraftCutoff(new Date()));
		if (cleared > 0) {
			logger.info('Expired import drafts cleared', { importCount: cleared });
		}
	}

	// Imports left running are settled lazily too, before each import. Each is a problem to watch.
	private async settleInterruptedImports(): Promise<void> {
		const settled = await this.imports.failRunningCreatedBefore(
			new Date(Date.now() - importLeaseMs),
			interruptedFailure
		);
		if (settled > 0) {
			logger.warn('Interrupted imports settled as failed', { importCount: settled });
		}
	}

	// The draft keeps the scans it was read from. Its provenance comes from the import's record when it
	// is reviewed, so the record holds the source URL and model.
	private async recordDraft(
		recipeImport: RecipeImport,
		source: ImportSource,
		extraction: Extraction
	): Promise<void> {
		const draft = importDraftFromExtractedRecipe(
			extraction.recipe,
			source.mode === 'photo' ? source.images : []
		);
		const recorded = await this.imports.recordSuccess(recipeImport.id, {
			draft,
			...(source.mode === 'url' && { sourceUrl: source.sourceUrl }),
			...(extraction.model !== undefined && { aiModel: extraction.model }),
			...(extraction.costUsd !== undefined && { costUsd: extraction.costUsd }),
		});
		if (!recorded) {
			throw new Error('Import was no longer running');
		}

		logger.info('Import finished', {
			importId: recipeImport.id,
			memberId: recipeImport.memberId,
			mode: recipeImport.mode,
			...(extraction.model !== undefined && { aiModel: extraction.model }),
			...(extraction.costUsd !== undefined && { costUsd: extraction.costUsd }),
		});
	}

	// Logged before it is recorded, so the logs keep the failure even when recording it fails. Import
	// errors' causes carry codes and ids only, never the page or the model's output. An unexpected error
	// is a failure, a failed or paused model call or a timed-out import a problem to watch, and an
	// expected refusal routine. A record that does not land in time stays running until the
	// interrupted-import lease settles it, so the member still hears of the import's own failure.
	private async recordFailure(
		recipeImport: RecipeImport,
		error: unknown,
		extraction: Extraction | null
	): Promise<void> {
		const failure = error instanceof AppError ? error.code : unexpectedFailure;
		const costUsd = extraction?.costUsd;
		const fields = {
			importId: recipeImport.id,
			memberId: recipeImport.memberId,
			mode: recipeImport.mode,
			failure,
			...(error instanceof ImportPageUnavailableError && { reason: error.reason }),
			...(error instanceof ImportPageRefusedError && { status: error.status }),
			...(extraction?.model !== undefined && { aiModel: extraction.model }),
			...(costUsd !== undefined && { costUsd }),
			...(logsError(error) && { err: error }),
		};
		if (!(error instanceof AppError)) {
			logger.error('Import failed', fields);
		} else if (
			error instanceof ImportFailedError ||
			error instanceof ImportPausedError ||
			error instanceof ImportTimedOutError
		) {
			logger.warn('Import failed', fields);
		} else {
			logger.info('Import failed', fields);
		}
		try {
			await settleWithin(
				this.imports.recordFailure(recipeImport.id, {
					failure,
					...(costUsd !== undefined && { costUsd }),
				}),
				{ deadline: deadlineAfter(failureRecordingTimeLimitMs) },
				() => new FailureRecordingTimedOutError()
			);
		} catch (recordingError) {
			if (!(recordingError instanceof FailureRecordingTimedOutError)) {
				throw recordingError;
			}
			logger.warn('Import failure not recorded in time, so its lease settles it later', {
				importId: recipeImport.id,
				memberId: recipeImport.memberId,
				mode: recipeImport.mode,
				failure,
			});
		}
	}

	// The page's structured data when it holds a whole recipe; otherwise a model reads the page.
	private async extractFromPage(
		page: WebPage,
		requester: ExtractionRequester,
		deadline: AbortSignal
	): Promise<Extraction | null> {
		const structured = await this.structuredData.extract(page, requester, deadline);
		if (structured !== null && isComplete(structured.recipe)) {
			return structured;
		}

		return this.pageReader.extract(page, requester, deadline);
	}

	// Names, and whether another member's recipe or draft names a scan, are checked before the store is
	// read, so refused pathnames never reach it. The member's own scans can be imported again.
	private async readScans(
		pathnames: readonly string[],
		memberId: MemberId,
		deadline: AbortSignal
	): Promise<ScanImage[]> {
		if (pathnames.length === 0 || pathnames.length > settings.photos.maxScansPerImport) {
			const message = pathnames.length === 0 ? noScansMessage : tooManyScansMessage;
			throw new InvalidImportError([{ path: 'scans', message }]);
		}

		assertNoScanProblems(
			pathnames.map((pathname, index) => this.scanNameProblem(pathname, index, pathnames))
		);
		const othersScans = await imagesInUse(
			pathnames,
			this.recipes,
			this.imports,
			new Date(),
			memberId
		);
		assertNoScanProblems(
			pathnames.map((pathname) => (othersScans.has(pathname) ? unstoredScanMessage : undefined))
		);
		const scans = await Promise.all(pathnames.map((pathname) => this.readScan(pathname, deadline)));
		assertNoScanProblems(scans.map(scanContentProblem));
		return scans.filter((scan) => scan !== null);
	}

	// Exactly a new upload's name in this environment's scan folder, listed once.
	private scanNameProblem(
		pathname: string,
		index: number,
		pathnames: readonly string[]
	): string | undefined {
		if (
			!pathname.startsWith(this.folders.uploadFolder('scan')) ||
			!this.folders.isUploadName(pathname)
		) {
			return unstoredScanMessage;
		}

		return pathnames.indexOf(pathname) === index ? undefined : repeatedScanMessage;
	}

	// Null when the store holds no JPEG under the name.
	private async readScan(pathname: string, deadline: AbortSignal): Promise<ScanImage | null> {
		const image = await this.images.get(pathname, deadline);
		if (image === null) {
			return null;
		}

		if (image.contentType !== scanMediaType) {
			await image.body.cancel();
			return null;
		}

		const bytes = new Uint8Array(await new Response(image.body).arrayBuffer());
		return { bytes, mediaType: scanMediaType };
	}
}
