import { createGateway } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { z } from 'zod';
import { ImportFailedError, ImportPausedError } from '@/application/ingestion/errors';
import type { ExtractionRequester, ScanImage } from '@/application/ports/recipe-extractors';
import { memberIdSchema } from '@/domain/member/member';
import { AiScanRecipeExtractor } from '@/infrastructure/ai/ai-scan-recipe-extractor';
import { scanInstructions, scanTask } from '@/infrastructure/ai/extraction-prompts';
import type { scanOutputSchema } from '@/infrastructure/ai/recipe-output';

type GenerateResult = Awaited<ReturnType<MockLanguageModelV4['doGenerate']>>;
type ScanOutput = z.infer<typeof scanOutputSchema>;

const requester: ExtractionRequester = {
	memberId: memberIdSchema.parse('0199d2e8-4b7a-7c3e-9a1f-6e2d8c4b0a75'),
};
// The SHA-256 of the member's id, in hex.
const safetyIdentifier = 'ddc99d0a0120fa986be91caf0cabfbcafbdc9c4000ff1c108176e0e6619a11b6';

const scans: ScanImage[] = [
	{ bytes: new Uint8Array([0xff, 0xd8, 0xff, 0x01]), mediaType: 'image/jpeg' },
	{ bytes: new Uint8Array([0xff, 0xd8, 0xff, 0x02]), mediaType: 'image/jpeg' },
];

// A synthetic card as a model might read it, with every kind of absent value.
const cardOutput: ScanOutput = {
	transcription:
		'Lemon bars\nFrom Great-aunt Edie\n1 c. flour\n1/2 c. butter [?]\n2 eggs\nPress crust into pan. Bake 20 min.',
	title: 'Lemon bars',
	description: null,
	notes: null,
	source: 'Great-aunt Edie',
	yield: { kind: 'makes', amount: '16', unit: null },
	prepMinutes: null,
	cookMinutes: 45,
	totalMinutes: null,
	ingredientSections: [
		{ heading: null, lines: ['1 c. flour', '1/2 c. butter [?]'] },
		{ heading: 'Filling', lines: ['2 eggs'] },
	],
	instructionSections: [{ heading: null, steps: ['Press crust into pan. Bake 20 min.'] }],
	reviewNotes: [
		{
			field: 'ingredient',
			section: 0,
			line: 1,
			note: 'Check this line against the original. Part of it was hard to read.',
		},
		{
			field: 'title',
			section: null,
			line: null,
			note: "Check the title. The card's top edge is torn.",
		},
	],
};

const noRecipeOutput: ScanOutput = {
	transcription: 'Grocery list: milk, eggs',
	title: null,
	description: null,
	notes: null,
	source: null,
	yield: null,
	prepMinutes: null,
	cookMinutes: null,
	totalMinutes: null,
	ingredientSections: [],
	instructionSections: [],
	reviewNotes: [],
};

const usage: GenerateResult['usage'] = {
	inputTokens: { total: 9000, noCache: 9000, cacheRead: undefined, cacheWrite: undefined },
	outputTokens: { total: 900, text: 900, reasoning: undefined },
};

function answer(output: object, result: Partial<GenerateResult> = {}): GenerateResult {
	return {
		content: [{ type: 'text', text: JSON.stringify(output) }],
		finishReason: { unified: 'stop', raw: 'end_turn' },
		usage,
		warnings: [],
		...result,
	};
}

// The real Gateway provider, answering every request with the given responses in turn.
function gatewayAnswering(...responses: { status: number; body: object }[]) {
	const fetch = vi.fn(async () => {
		const { status, body } = responses.shift() ?? { status: 500, body: {} };
		return Response.json(body, { status });
	});
	return createGateway({ apiKey: 'test-key', fetch })('anthropic/claude-haiku-5.5');
}

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe('extract', () => {
	it('sends every page after its label, then the task, with the instructions as the system prompt', async () => {
		const model = new MockLanguageModelV4({ doGenerate: answer(cardOutput) });

		await new AiScanRecipeExtractor(model).extract(scans, requester);

		expect(model.doGenerateCalls).toHaveLength(1);
		const [call] = model.doGenerateCalls;
		expect(call?.prompt).toEqual([
			{ role: 'system', content: scanInstructions },
			{
				role: 'user',
				content: [
					{ type: 'text', text: 'Page 1 of 2' },
					expect.objectContaining({
						type: 'file',
						mediaType: 'image/jpeg',
						data: { type: 'data', data: scans[0]?.bytes },
						providerOptions: { openai: { imageDetail: 'high' } },
					}),
					{ type: 'text', text: 'Page 2 of 2' },
					expect.objectContaining({
						type: 'file',
						mediaType: 'image/jpeg',
						data: { type: 'data', data: scans[1]?.bytes },
						providerOptions: { openai: { imageDetail: 'high' } },
					}),
					{ type: 'text', text: scanTask },
				],
			},
		]);
	});

	it('asks for the output schema in at most 16,000 tokens, with no sampling parameters', async () => {
		const model = new MockLanguageModelV4({ doGenerate: answer(cardOutput) });

		await new AiScanRecipeExtractor(model).extract(scans, requester);

		const [call] = model.doGenerateCalls;
		expect(call?.responseFormat).toMatchObject({
			type: 'json',
			name: 'recipe',
			schema: { type: 'object', properties: { transcription: { type: 'string' } } },
		});
		expect(call?.maxOutputTokens).toBe(16_000);
		expect(call?.temperature).toBeUndefined();
		expect(call?.topP).toBeUndefined();
		expect(call?.topK).toBeUndefined();
	});

	it("labels the call with the member's id and its hash, with zero data retention", async () => {
		const model = new MockLanguageModelV4({ doGenerate: answer(cardOutput) });

		await new AiScanRecipeExtractor(model).extract(scans, requester);

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

	it("sends the member's id and its hash in the Gateway's request", async () => {
		const bodies: unknown[] = [];
		const fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
			bodies.push(JSON.parse(String(init?.body)));
			return Response.json(
				{ error: { message: 'Invalid request', type: 'invalid_request_error' } },
				{ status: 400 }
			);
		});
		const model = createGateway({ apiKey: 'test-key', fetch })('anthropic/claude-haiku-5.5');

		await new AiScanRecipeExtractor(model).extract(scans, requester).catch(() => undefined);

		expect(bodies).toEqual([
			expect.objectContaining({
				providerOptions: {
					gateway: {
						zeroDataRetention: true,
						user: '0199d2e8-4b7a-7c3e-9a1f-6e2d8c4b0a75',
						safetyIdentifier,
					},
				},
			}),
		]);
	});

	it('maps the output into an extracted recipe, leaving out what the card does not state', async () => {
		const model = new MockLanguageModelV4({ doGenerate: answer(cardOutput) });

		const extraction = await new AiScanRecipeExtractor(model).extract(scans, requester);

		expect(extraction?.recipe).toStrictEqual({
			title: 'Lemon bars',
			source: 'Great-aunt Edie',
			yield: { kind: 'makes', amount: '16' },
			times: { cookMinutes: 45 },
			ingredientSections: [
				{ lines: ['1 c. flour', '1/2 c. butter [?]'] },
				{ heading: 'Filling', lines: ['2 eggs'] },
			],
			instructionSections: [{ steps: ['Press crust into pan. Bake 20 min.'] }],
			reviewNotes: [
				{
					field: 'ingredient',
					section: 0,
					line: 1,
					note: 'Check this line against the original. Part of it was hard to read.',
				},
				{ field: 'title', note: "Check the title. The card's top edge is torn." },
			],
		});
	});

	it('puts a note on a line in the only section of its kind, and leaves other sectionless notes as given', async () => {
		const model = new MockLanguageModelV4({
			doGenerate: answer({
				...cardOutput,
				reviewNotes: [
					{ field: 'step', section: null, line: 0, note: 'Check the baking time.' },
					{ field: 'ingredient', section: null, line: 1, note: 'Check this amount.' },
				],
			}),
		});

		const extraction = await new AiScanRecipeExtractor(model).extract(scans, requester);

		expect(extraction?.recipe.reviewNotes).toStrictEqual([
			{ field: 'step', section: 0, line: 0, note: 'Check the baking time.' },
			{ field: 'ingredient', line: 1, note: 'Check this amount.' },
		]);
	});

	it('returns the empty reading with its model and cost when the photos hold no recipe', async () => {
		const model = new MockLanguageModelV4({
			doGenerate: answer(noRecipeOutput, {
				response: { modelId: 'anthropic/claude-haiku-5.5' },
				providerMetadata: { gateway: { cost: '0.0019' } },
			}),
		});

		const extraction = await new AiScanRecipeExtractor(model).extract(scans, requester);

		expect(extraction).toStrictEqual({
			recipe: { times: {}, ingredientSections: [], instructionSections: [], reviewNotes: [] },
			model: 'anthropic/claude-haiku-5.5',
			costUsd: 0.0019,
		});
	});

	it('reports the model that answered and what the Gateway charged', async () => {
		const model = new MockLanguageModelV4({
			modelId: 'anthropic/claude-sonnet-5.5',
			doGenerate: answer(cardOutput, {
				response: { modelId: 'anthropic/claude-haiku-5.5' },
				providerMetadata: { gateway: { cost: '0.0022418', generationId: 'gen_01' } },
			}),
		});

		const extraction = await new AiScanRecipeExtractor(model).extract(scans, requester);

		expect(extraction).toMatchObject({ model: 'anthropic/claude-haiku-5.5', costUsd: 0.0022418 });
	});

	it('leaves out the cost when the provider reports none', async () => {
		const model = new MockLanguageModelV4({ doGenerate: answer(cardOutput) });

		const extraction = await new AiScanRecipeExtractor(model).extract(scans, requester);

		expect(extraction).not.toHaveProperty('costUsd');
	});
});

describe('extract failures', () => {
	it.each([
		['credits run out', { message: 'Insufficient funds', type: 'insufficient_funds' }],
		[
			'the budget is spent',
			{
				message: 'Project budget exceeded. Current spend: $100, limit: $100',
				type: 'quota_for_entity_exceeded',
			},
		],
	])('pauses imports when %s', async (_, error) => {
		const model = gatewayAnswering({ status: 402, body: { error, generationId: 'gen_02' } });

		const failure = await new AiScanRecipeExtractor(model)
			.extract(scans, requester)
			.catch((caught: unknown) => caught);

		expect(failure).toBeInstanceOf(ImportPausedError);
		expect((failure as ImportPausedError).cause).toEqual({
			name: 'GatewayInternalServerError',
			statusCode: 402,
			generationId: 'gen_02',
		});
	});

	it('pauses imports when the budget runs out on a retry', async () => {
		vi.useFakeTimers();
		const model = gatewayAnswering(
			{ status: 503, body: { error: { message: 'Overloaded', type: 'internal_server_error' } } },
			{
				status: 402,
				body: { error: { message: 'Insufficient funds', type: 'insufficient_funds' } },
			}
		);

		const failure = new AiScanRecipeExtractor(model)
			.extract(scans, requester)
			.catch((caught: unknown) => caught);
		await vi.runAllTimersAsync();

		expect(await failure).toBeInstanceOf(ImportPausedError);
	});

	it('fails with only the code and id of any other Gateway error', async () => {
		const model = gatewayAnswering({
			status: 400,
			body: {
				error: { message: 'Invalid image: 1 c. flour', type: 'invalid_request_error' },
				generationId: 'gen_03',
			},
		});

		const failure = await new AiScanRecipeExtractor(model)
			.extract(scans, requester)
			.catch((caught: unknown) => caught);

		expect(failure).toBeInstanceOf(ImportFailedError);
		expect((failure as ImportFailedError).cause).toEqual({
			name: 'GatewayInvalidRequestError',
			statusCode: 400,
			generationId: 'gen_03',
		});
	});

	it('fails without the output when it does not fit the schema', async () => {
		const model = new MockLanguageModelV4({
			doGenerate: answer({ ...cardOutput, ingredientSections: '1 c. flour' }),
		});

		const failure = await new AiScanRecipeExtractor(model)
			.extract(scans, requester)
			.catch((caught: unknown) => caught);

		expect(failure).toBeInstanceOf(ImportFailedError);
		expect((failure as ImportFailedError).cause).toEqual({
			name: 'AI_NoObjectGeneratedError',
			finishReason: 'stop',
		});
		expect(JSON.stringify((failure as ImportFailedError).cause)).not.toContain('flour');
	});

	it('fails when the model refuses', async () => {
		const model = new MockLanguageModelV4({
			doGenerate: {
				content: [],
				finishReason: { unified: 'content-filter', raw: 'refusal' },
				usage,
				warnings: [],
			},
		});

		const failure = await new AiScanRecipeExtractor(model)
			.extract(scans, requester)
			.catch((caught: unknown) => caught);

		expect(failure).toBeInstanceOf(ImportFailedError);
		expect((failure as ImportFailedError).cause).toEqual({
			name: 'AI_NoOutputGeneratedError',
			finishReason: 'content-filter',
		});
	});

	it('fails when the model takes longer than 90 seconds', async () => {
		// The SDK times a call with AbortSignal.timeout, which fake timers do not reach.
		const timeout = new AbortController();
		const timeoutSpy = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(timeout.signal);
		const model = new MockLanguageModelV4({
			doGenerate: ({ abortSignal }) =>
				new Promise((_, reject) => {
					abortSignal?.addEventListener('abort', () => reject(abortSignal.reason));
				}),
		});

		const failure = new AiScanRecipeExtractor(model)
			.extract(scans, requester)
			.catch((caught: unknown) => caught);
		await vi.waitFor(() => expect(model.doGenerateCalls).toHaveLength(1));
		timeout.abort(new DOMException('The operation timed out.', 'TimeoutError'));

		expect(timeoutSpy).toHaveBeenCalledWith(90_000);
		expect(await failure).toBeInstanceOf(ImportFailedError);
		expect(((await failure) as ImportFailedError).cause).toEqual({ name: 'TimeoutError' });
	});

	it("stops the call once the caller's signal aborts", async () => {
		const caller = new AbortController();
		const model = new MockLanguageModelV4({
			doGenerate: ({ abortSignal }) =>
				new Promise((_, reject) => {
					abortSignal?.addEventListener('abort', () => reject(abortSignal.reason));
				}),
		});

		const failure = new AiScanRecipeExtractor(model)
			.extract(scans, requester, caller.signal)
			.catch((caught: unknown) => caught);
		await vi.waitFor(() => expect(model.doGenerateCalls).toHaveLength(1));
		caller.abort();

		expect(await failure).toBeInstanceOf(ImportFailedError);
		expect(((await failure) as ImportFailedError).cause).toEqual({ name: 'AbortError' });
	});
});
