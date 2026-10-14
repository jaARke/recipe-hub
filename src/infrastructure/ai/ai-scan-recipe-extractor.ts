import 'server-only';
import type { FilePart, LanguageModel, TextPart } from 'ai';
import type {
	Extraction,
	ExtractionRequester,
	ScanImage,
	ScanRecipeExtractor,
} from '@/application/ports/recipe-extractors';
import { scanInstructions, scanPageLabel, scanTask } from '@/infrastructure/ai/extraction-prompts';
import { extractWithModel } from '@/infrastructure/ai/model-extraction';
import { scanOutputSchema } from '@/infrastructure/ai/recipe-output';

// OpenAI's default reads a 3072 px scan at full size for about three times the tokens; high detail
// is plenty for handwriting. Anthropic has no such setting, and Gemini's default suits text.
const imageProviderOptions = { openai: { imageDetail: 'high' } };

// Reads every page in one call, so a list that runs onto the back of a card stays one list.
export class AiScanRecipeExtractor implements ScanRecipeExtractor {
	private readonly model: LanguageModel;

	// A Gateway model id such as "anthropic/claude-haiku-5.5", or a model object.
	constructor(model: LanguageModel) {
		this.model = model;
	}

	extract(
		scans: readonly ScanImage[],
		requester: ExtractionRequester,
		signal?: AbortSignal
	): Promise<Extraction> {
		const pages = scans.flatMap((scan, index): (TextPart | FilePart)[] => [
			{ type: 'text', text: scanPageLabel(index, scans.length) },
			{
				type: 'file',
				mediaType: scan.mediaType,
				data: scan.bytes,
				providerOptions: imageProviderOptions,
			},
		]);

		return extractWithModel({
			model: this.model,
			instructions: scanInstructions,
			schema: scanOutputSchema,
			content: [...pages, { type: 'text', text: scanTask }],
			requester,
			signal,
		});
	}
}
