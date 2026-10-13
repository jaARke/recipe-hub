import 'server-only';
import { z } from 'zod';
import { requireMember } from '@/application/authorization';
import {
	ImportFailedError,
	ImportNoRecipeError,
	ImportPageRefusedError,
	ImportPageUnavailableError,
	ImportRateLimitedError,
	InvalidImportError,
} from '@/application/ingestion/errors';
import {
	toImportDraftDto,
	type ImportReviewDto,
	type RecipeImportRef,
	type UnsavedImportDto,
} from '@/application/ingestion/recipe-import-dtos';
import { MemberNotFoundError } from '@/application/members/errors';
import type { ActorProvider, MemberActor } from '@/application/ports/actor-provider';
import type { ImageStore } from '@/application/ports/image-store';
import type { MemberRepository } from '@/application/ports/member-repository';
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
import type { WebPage, WebPageFetcher } from '@/application/ports/web-page-fetcher';
import type { ImageFolders } from '@/application/recipes/image-folders';
import {
	importDraftFromExtractedRecipe,
	type ExtractedRecipe,
} from '@/domain/recipe/extracted-recipe';
import { maxImportScans, maxImportScanSizeInBytes } from '@/domain/recipe/import-limits';
import type { RecipeImage } from '@/domain/recipe/recipe-image';
import {
	importDraftCutoff,
	recipeImportIdSchema,
	reviewableDraft,
	type RecipeImport,
} from '@/domain/recipe/recipe-import';
import { hasNoNul, nonEmptyTextSchema } from '@/domain/text';
import { AppError } from '@/lib/errors';
import { getLogger } from '@/lib/logger';

// Imports a member may start in any rolling day. Admins have no limit.
const maxImportsPerDay = 50;
const dayInMilliseconds = 24 * 60 * 60 * 1000;

// The drafts listed beside the import forms.
const maxUnsavedImports = 10;

// The browser re-encodes every scan as a JPEG before uploading it.
const scanMediaType = 'image/jpeg' satisfies ScanImage['mediaType'];

// As provenance stores a source URL: http or https and a named host, without the NUL character
// that Postgres text cannot hold.
const importUrlSchema = z.httpUrl().refine(hasNoNul);

const invalidUrlMessage = 'Enter a web address that starts with http:// or https://.';
const noScansMessage = 'Add at least one photo.';
const tooManyScansMessage = `Use ${maxImportScans} photos or fewer.`;
// For a scan this environment never stored: its upload failed, was cut off, or never happened.
const unstoredScanMessage = "This photo didn't finish uploading. Remove it and add it again.";
const repeatedScanMessage = 'This photo is already attached.';
const largeScanMessage = 'This photo is too large to read. Crop it to the recipe and add it again.';

// Recorded for a failure that is not an expected error, which would carry a code.
const unexpectedFailure = 'unexpected';

const logger = getLogger('imports');

// What an import reads: the page at the address the member gave, or their scans, which stay
// attached to the recipe.
type ImportSource =
	{ mode: 'url'; sourceUrl: string } | { mode: 'photo'; images: readonly RecipeImage[] };

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
		: { maxImports: maxImportsPerDay, since: new Date(now.getTime() - dayInMilliseconds) };
}

// An expected failure's code says what happened. An unexpected one keeps its stack, and a failed
// model call its cause, which holds the call's status, finish reason, and generation id.
function logsError(error: unknown): boolean {
	return !(error instanceof AppError) || error instanceof ImportFailedError;
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
	private readonly imports: RecipeImportRepository;
	private readonly members: MemberRepository;
	private readonly pages: WebPageFetcher;
	private readonly structuredData: PageRecipeExtractor;
	private readonly pageReader: PageRecipeExtractor;
	private readonly scanReader: ScanRecipeExtractor;
	private readonly images: ImageStore;
	private readonly actors: ActorProvider;
	private readonly folders: ImageFolders;

	// A page is read from its structured data, which costs nothing, or by the page reader's model.
	constructor(
		imports: RecipeImportRepository,
		members: MemberRepository,
		pages: WebPageFetcher,
		structuredData: PageRecipeExtractor,
		pageReader: PageRecipeExtractor,
		scanReader: ScanRecipeExtractor,
		images: ImageStore,
		actors: ActorProvider,
		folders: ImageFolders
	) {
		this.imports = imports;
		this.members = members;
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
		const actor = requireMember(await this.actors.currentActor());
		const sourceUrl = importUrl(url);
		return this.runImport(actor, { mode: 'url', sourceUrl }, async (requester) =>
			this.extractFromPage(await this.pages.fetch(sourceUrl), requester)
		);
	}

	// Every page goes to the model in one call, so a recipe that runs onto the back of a card stays one
	// recipe. Pathnames are the browser's upload names, in page order.
	async importFromScans(pathnames: readonly string[]): Promise<RecipeImportRef> {
		const actor = requireMember(await this.actors.currentActor());
		const scans = await this.readScans(pathnames);
		const images = pathnames.map((pathname): RecipeImage => ({ role: 'scan', pathname }));
		return this.runImport(actor, { mode: 'photo', images }, (requester) =>
			this.scanReader.extract(scans, requester)
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
			maxUnsavedImports
		);
	}

	// The repository counts the member's recent imports and starts this one under one lock. Every
	// outcome is recorded, with what the model calls cost.
	private async runImport(
		actor: MemberActor,
		source: ImportSource,
		extract: (requester: ExtractionRequester) => Promise<Extraction | null>
	): Promise<RecipeImportRef> {
		const requester = await this.readRequester(actor);
		await this.clearExpiredDrafts();
		const recipeImport = await this.imports.start(
			{ memberId: actor.memberId, mode: source.mode },
			importLimit(actor, new Date())
		);
		if (recipeImport === null) {
			logger.warn('Import refused at the daily limit', {
				memberId: actor.memberId,
				mode: source.mode,
			});
			throw new ImportRateLimitedError();
		}

		logger.info('Import started', {
			importId: recipeImport.id,
			memberId: recipeImport.memberId,
			mode: recipeImport.mode,
		});
		let extraction: Extraction | null = null;
		try {
			extraction = await extract(requester);
			if (extraction === null || !foundRecipe(extraction.recipe)) {
				throw new ImportNoRecipeError();
			}

			await this.recordDraft(recipeImport, source, extraction);
		} catch (error) {
			await this.recordFailure(recipeImport, error, extraction);
			throw error;
		}

		return { id: recipeImport.id };
	}

	// Read before the import starts, whose record must name a member. A session ends with its member's
	// account, so a missing account was removed during this request.
	private async readRequester(actor: MemberActor): Promise<ExtractionRequester> {
		const member = await this.members.findById(actor.memberId);
		if (member === null) {
			throw new MemberNotFoundError();
		}

		return { memberId: member.id, email: member.email };
	}

	// Drafts are cleared lazily, before each import, so no scheduled job is needed.
	private async clearExpiredDrafts(): Promise<void> {
		const cleared = await this.imports.clearDraftsCreatedBefore(importDraftCutoff(new Date()));
		if (cleared > 0) {
			logger.info('Expired import drafts cleared', { importCount: cleared });
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
	// errors' causes carry codes and ids only, never the page or the model's output.
	private async recordFailure(
		recipeImport: RecipeImport,
		error: unknown,
		extraction: Extraction | null
	): Promise<void> {
		const failure = error instanceof AppError ? error.code : unexpectedFailure;
		const costUsd = extraction?.costUsd;
		logger.info('Import failed', {
			importId: recipeImport.id,
			memberId: recipeImport.memberId,
			mode: recipeImport.mode,
			failure,
			...(error instanceof ImportPageUnavailableError && { reason: error.reason }),
			...(error instanceof ImportPageRefusedError && { status: error.status }),
			...(extraction?.model !== undefined && { aiModel: extraction.model }),
			...(costUsd !== undefined && { costUsd }),
			...(logsError(error) && { err: error }),
		});
		await this.imports.recordFailure(recipeImport.id, {
			failure,
			...(costUsd !== undefined && { costUsd }),
		});
	}

	// The page's structured data when it holds a whole recipe; otherwise a model reads the page.
	private async extractFromPage(
		page: WebPage,
		requester: ExtractionRequester
	): Promise<Extraction | null> {
		const structured = await this.structuredData.extract(page, requester);
		if (structured !== null && isComplete(structured.recipe)) {
			return structured;
		}

		return this.pageReader.extract(page, requester);
	}

	// Names are checked before the store is read, so refused pathnames never reach it.
	private async readScans(pathnames: readonly string[]): Promise<ScanImage[]> {
		if (pathnames.length === 0 || pathnames.length > maxImportScans) {
			const message = pathnames.length === 0 ? noScansMessage : tooManyScansMessage;
			throw new InvalidImportError([{ path: 'scans', message }]);
		}

		assertNoScanProblems(
			pathnames.map((pathname, index) => this.scanNameProblem(pathname, index, pathnames))
		);
		const scans = await Promise.all(pathnames.map((pathname) => this.readScan(pathname)));
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
	private async readScan(pathname: string): Promise<ScanImage | null> {
		const image = await this.images.get(pathname);
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
