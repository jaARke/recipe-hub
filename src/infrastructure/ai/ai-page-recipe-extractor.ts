import 'server-only';
import type { LanguageModel } from 'ai';
import type {
	Extraction,
	ExtractionRequester,
	PageRecipeExtractor,
} from '@/application/ports/recipe-extractors';
import type { WebPage } from '@/application/ports/web-page-fetcher';
import { pageInstructions, pagePrompt } from '@/infrastructure/ai/extraction-prompts';
import { extractWithModel } from '@/infrastructure/ai/model-extraction';
import { pageOutputSchema } from '@/infrastructure/ai/recipe-output';
import { pageText } from '@/infrastructure/web/page-text';

// Reads the page's plain text. Unlike a photo, the text is already a transcription, so the output
// has no transcription field.
export class AiPageRecipeExtractor implements PageRecipeExtractor {
	private readonly model: LanguageModel;

	// A Gateway model id such as "anthropic/claude-haiku-5.5", or a model object.
	constructor(model: LanguageModel) {
		this.model = model;
	}

	extract(page: WebPage, requester: ExtractionRequester): Promise<Extraction> {
		return extractWithModel({
			model: this.model,
			instructions: pageInstructions,
			schema: pageOutputSchema,
			content: [{ type: 'text', text: pagePrompt(pageText(page)) }],
			requester,
		});
	}
}
