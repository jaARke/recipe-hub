import type {
	Extraction,
	ExtractionRequester,
	PageRecipeExtractor,
	ScanImage,
	ScanRecipeExtractor,
} from '@/application/ports/recipe-extractors';
import type { WebPage } from '@/application/ports/web-page-fetcher';

// What a fixed extractor answers: an extraction, null for nothing found, or an error to fail with.
type FixedExtractorResult = Extraction | null | Error;

function answer(result: FixedExtractorResult): Extraction | null {
	if (result instanceof Error) {
		throw result;
	}

	return result;
}

// Answers every page alike and records the pages it read, so tests can prove it was never asked, and
// whom it read each for.
export class FixedPageRecipeExtractor implements PageRecipeExtractor {
	private readonly result: FixedExtractorResult;
	private readonly pages: WebPage[] = [];
	private readonly requesters: ExtractionRequester[] = [];

	constructor(result: FixedExtractorResult) {
		this.result = result;
	}

	get readPages(): readonly WebPage[] {
		return this.pages;
	}

	get receivedRequesters(): readonly ExtractionRequester[] {
		return this.requesters;
	}

	async extract(page: WebPage, requester: ExtractionRequester): Promise<Extraction | null> {
		this.pages.push(page);
		this.requesters.push(requester);
		return answer(this.result);
	}
}

// Answers every set of scans alike and records each set it read, and whom it read each for.
export class FixedScanRecipeExtractor implements ScanRecipeExtractor {
	private readonly result: FixedExtractorResult;
	private readonly scanSets: (readonly ScanImage[])[] = [];
	private readonly requesters: ExtractionRequester[] = [];

	constructor(result: FixedExtractorResult) {
		this.result = result;
	}

	get readScanSets(): readonly (readonly ScanImage[])[] {
		return this.scanSets;
	}

	get receivedRequesters(): readonly ExtractionRequester[] {
		return this.requesters;
	}

	async extract(
		scans: readonly ScanImage[],
		requester: ExtractionRequester
	): Promise<Extraction | null> {
		this.scanSets.push(scans);
		this.requesters.push(requester);
		return answer(this.result);
	}
}
