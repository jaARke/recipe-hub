import 'server-only';
import { createHash } from 'node:crypto';
import {
	generateText,
	Output,
	RetryError,
	type FilePart,
	type LanguageModel,
	type TextPart,
} from 'ai';
import { z } from 'zod';
import { ImportFailedError, ImportPausedError } from '@/application/ingestion/errors';
import type { Extraction, ExtractionRequester } from '@/application/ports/recipe-extractors';
import { toExtractedRecipe, type RecipeOutput } from '@/infrastructure/ai/recipe-output';

// Bounds a call and its retries. Several pages of handwriting take the longest.
const extractionTimeoutMs = 90_000;

// The Gateway's answer once the team's credits or budget run out, which @ai-sdk/gateway raises as a
// GatewayInternalServerError carrying the status.
const paymentRequiredStatus = 402;

// The Gateway reports each call's cost in US dollars as a decimal string.
const gatewayCostSchema = z.object({ gateway: z.object({ cost: z.coerce.number() }) });

// What a failed call's error tells an operator. Messages can quote the model's output, and services
// log the cause, so the cause keeps only codes and ids.
const failureSchema = z.object({
	name: z.string().optional(),
	statusCode: z.number().optional(),
	finishReason: z.string().optional(),
	generationId: z.string().optional(),
});

type ModelExtractionRequest = {
	model: LanguageModel;
	instructions: string;
	schema: z.ZodType<RecipeOutput>;
	// The source, then the task.
	content: (TextPart | FilePart)[];
	requester: ExtractionRequester;
};

// Content stays with the Gateway only for the request; this holds the providers it routes to, and
// any fallback, to zero data retention too. The member's id labels the call in the Gateway's usage
// reports, which never see their email.
function gatewayOptions(requester: ExtractionRequester) {
	return {
		gateway: {
			zeroDataRetention: true,
			user: requester.memberId,
			// Providers get a hash of the id instead, as Vercel advises, to trace misuse to one account.
			safetyIdentifier: createHash('sha256').update(requester.memberId).digest('hex'),
		},
	};
}

// After retries the SDK wraps the last failure, which is the one that decides.
function toImportError(
	error: unknown,
	finishReason?: string
): ImportPausedError | ImportFailedError {
	const failure = RetryError.isInstance(error) ? error.lastError : error;
	const parsed = failureSchema.safeParse(failure);
	const cause = { finishReason, ...(parsed.success && parsed.data) };
	return cause.statusCode === paymentRequiredStatus
		? new ImportPausedError({ cause })
		: new ImportFailedError({ cause });
}

// One structured-output call. A call that found no recipe returns its empty reading, since it was paid.
export async function extractWithModel(request: ModelExtractionRequest): Promise<Extraction> {
	let result;
	try {
		result = await generateText({
			model: request.model,
			instructions: request.instructions,
			messages: [{ role: 'user', content: request.content }],
			output: Output.object({ name: 'recipe', schema: request.schema }),
			providerOptions: gatewayOptions(request.requester),
			timeout: extractionTimeoutMs,
		});
	} catch (error) {
		throw toImportError(error);
	}

	let output: RecipeOutput;
	try {
		output = result.output;
	} catch (error) {
		// A refusal or a cut-off answer leaves no output, and only the finish reason tells which.
		throw toImportError(error, result.finalStep.finishReason);
	}

	// The Gateway's response names no model, so the SDK reports the one asked for. That is the one
	// that answered as long as no fallback models are configured.
	const cost = gatewayCostSchema.safeParse(result.finalStep.providerMetadata);
	return {
		recipe: toExtractedRecipe(output),
		model: result.finalStep.response.modelId,
		...(cost.success && { costUsd: cost.data.gateway.cost }),
	};
}
