import { MockLanguageModelV4 } from 'ai/test';
import { describe, expect, it, vi } from 'vitest';
import { ImportFailedError } from '@/application/ingestion/errors';
import type { ExtractionRequester } from '@/application/ports/recipe-extractors';
import type { WebPage } from '@/application/ports/web-page-fetcher';
import { memberIdSchema } from '@/domain/member/member';
import { AiPageRecipeExtractor } from '@/infrastructure/ai/ai-page-recipe-extractor';
import { pageInstructions, pagePrompt } from '@/infrastructure/ai/extraction-prompts';
import type { RecipeOutput } from '@/infrastructure/ai/recipe-output';
import { pageText } from '@/infrastructure/web/page-text';

type GenerateResult = Awaited<ReturnType<MockLanguageModelV4['doGenerate']>>;

const requester: ExtractionRequester = {
	memberId: memberIdSchema.parse('0199d2e8-4b7a-7c3e-9a1f-6e2d8c4b0a75'),
};
// The SHA-256 of the member's id, in hex.
const safetyIdentifier = 'ddc99d0a0120fa986be91caf0cabfbcafbdc9c4000ff1c108176e0e6619a11b6';

const page: WebPage = {
	url: 'https://recipes.example.com/lemonade',
	html: `<!doctype html>
<html>
	<body>
		<nav>Home | Recipes</nav>
		<h1>Fresh lemonade</h1>
		<h2>Ingredients</h2>
		<ul><li>1 cup sugar</li><li>6 lemons</li></ul>
		<h2>Instructions</h2>
		<ol><li>Stir the sugar into the lemon juice.</li></ol>
		<p>Vegan and gluten-free, for the Fourth of July.</p>
	</body>
</html>`,
};

const pageOutput: RecipeOutput = {
	title: 'Fresh lemonade',
	description: null,
	notes: null,
	source: null,
	yield: { kind: 'servings', amount: '4 to 6', unit: null },
	prepMinutes: 10,
	cookMinutes: null,
	totalMinutes: null,
	ingredientSections: [{ heading: null, lines: ['1 cup sugar', '6 lemons'] }],
	instructionSections: [{ heading: null, steps: ['Stir the sugar into the lemon juice.'] }],
	chapter: 'appetizers-beverages',
	holidays: ['fourth-of-july'],
	diets: ['vegan', 'gluten-free'],
	reviewNotes: [],
};

function answer(output: object): GenerateResult {
	return {
		content: [{ type: 'text', text: JSON.stringify(output) }],
		finishReason: { unified: 'stop', raw: 'stop' },
		usage: {
			inputTokens: { total: 1500, noCache: 1500, cacheRead: undefined, cacheWrite: undefined },
			outputTokens: { total: 400, text: 400, reasoning: undefined },
		},
		warnings: [],
	};
}

describe('extract', () => {
	it("sends the page's text inside page tags, then the task", async () => {
		const model = new MockLanguageModelV4({ doGenerate: answer(pageOutput) });

		await new AiPageRecipeExtractor(model).extract(page, requester);

		const [call] = model.doGenerateCalls;
		expect(call?.prompt).toEqual([
			{ role: 'system', content: pageInstructions },
			{ role: 'user', content: [{ type: 'text', text: pagePrompt(pageText(page)) }] },
		]);
		expect(pagePrompt(pageText(page))).toMatch(/^<page>\n[\s\S]*1 cup sugar[\s\S]*\n<\/page>\n\n/);
		expect(call?.temperature).toBeUndefined();
	});

	it("labels the call with the member's id and its hash, with zero data retention", async () => {
		const model = new MockLanguageModelV4({ doGenerate: answer(pageOutput) });

		await new AiPageRecipeExtractor(model).extract(page, requester);

		const [call] = model.doGenerateCalls;
		expect(call?.providerOptions).toEqual({
			gateway: {
				zeroDataRetention: true,
				user: '0199d2e8-4b7a-7c3e-9a1f-6e2d8c4b0a75',
				safetyIdentifier,
			},
		});
		expect(call?.providerOptions?.gateway?.safetyIdentifier).toHaveLength(64);
	});

	it('asks for the page schema, which has no transcription, in at most 16,000 tokens', async () => {
		const model = new MockLanguageModelV4({ doGenerate: answer(pageOutput) });

		await new AiPageRecipeExtractor(model).extract(page, requester);

		const [call] = model.doGenerateCalls;
		expect(call?.responseFormat).toMatchObject({ type: 'json', name: 'recipe' });
		expect(call?.responseFormat).not.toHaveProperty('schema.properties.transcription');
		expect(call?.maxOutputTokens).toBe(16_000);
	});

	it("stops the call once the caller's signal aborts", async () => {
		const caller = new AbortController();
		const model = new MockLanguageModelV4({
			doGenerate: ({ abortSignal }) =>
				new Promise((_, reject) => {
					abortSignal?.addEventListener('abort', () => reject(abortSignal.reason));
				}),
		});

		const failure = new AiPageRecipeExtractor(model)
			.extract(page, requester, caller.signal)
			.catch((caught: unknown) => caught);
		await vi.waitFor(() => expect(model.doGenerateCalls).toHaveLength(1));
		caller.abort();

		expect(await failure).toBeInstanceOf(ImportFailedError);
		expect(((await failure) as ImportFailedError).cause).toEqual({ name: 'AbortError' });
	});

	it('maps the output into an extracted recipe', async () => {
		const model = new MockLanguageModelV4({ doGenerate: answer(pageOutput) });

		const extraction = await new AiPageRecipeExtractor(model).extract(page, requester);

		expect(extraction?.recipe).toStrictEqual({
			title: 'Fresh lemonade',
			yield: { kind: 'servings', amount: '4 to 6' },
			times: { prepMinutes: 10 },
			ingredientSections: [{ lines: ['1 cup sugar', '6 lemons'] }],
			instructionSections: [{ steps: ['Stir the sugar into the lemon juice.'] }],
			chapter: 'appetizers-beverages',
			holidays: ['fourth-of-july'],
			diets: ['vegan', 'gluten-free'],
			reviewNotes: [],
		});
	});

	it('returns the empty reading with its model and cost when the page holds no recipe', async () => {
		const model = new MockLanguageModelV4({
			doGenerate: {
				...answer({ ...pageOutput, ingredientSections: [], instructionSections: [] }),
				response: { modelId: 'anthropic/claude-haiku-5.5' },
				providerMetadata: { gateway: { cost: '0.0004' } },
			},
		});

		const extraction = await new AiPageRecipeExtractor(model).extract(page, requester);

		expect(extraction).toMatchObject({
			recipe: { ingredientSections: [], instructionSections: [] },
			model: 'anthropic/claude-haiku-5.5',
			costUsd: 0.0004,
		});
	});
});
