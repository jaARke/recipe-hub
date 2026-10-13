import 'server-only';
import type { WebPage } from '@/application/ports/web-page-fetcher';
import type { MemberId } from '@/domain/member/member';
import type { ExtractedRecipe } from '@/domain/recipe/extracted-recipe';

export type Extraction = {
	recipe: ExtractedRecipe;
	// The model that answered, for recipes an AI model read. It can differ from the model asked when
	// the gateway falls back to another.
	model?: string;
	// What the model calls cost in US dollars, as the gateway reported it.
	costUsd?: number;
};

// The member an extraction is for. Extractors that call a model attribute the call to them, so its
// usage and any misuse trace back to one account.
export type ExtractionRequester = {
	memberId: MemberId;
	email: string;
};

// Reads a recipe from a web page: its structured data, or an AI model reading its text.
export interface PageRecipeExtractor {
	// Null only when the extractor found nothing without a paid call. A model that found no recipe
	// still returns its reading, with no ingredients or steps, and its cost.
	extract(page: WebPage, requester: ExtractionRequester): Promise<Extraction | null>;
}

export type ScanImage = {
	bytes: Uint8Array;
	mediaType: 'image/jpeg';
};

// Reads a recipe from photos of a written or printed recipe, given in page order.
export interface ScanRecipeExtractor {
	// Null only when the extractor found nothing without a paid call. A model that found no recipe
	// still returns its reading, with no ingredients or steps, and its cost.
	extract(scans: readonly ScanImage[], requester: ExtractionRequester): Promise<Extraction | null>;
}
