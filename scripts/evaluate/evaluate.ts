import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import nextEnv from '@next/env';
import { z } from 'zod';
import type {
	Extraction,
	ExtractionRequester,
	PageRecipeExtractor,
	ScanImage,
	ScanRecipeExtractor,
} from '@/application/ports/recipe-extractors';
import type { WebPage } from '@/application/ports/web-page-fetcher';
import { memberIdSchema } from '@/domain/member/member';
import { chapters } from '@/domain/recipe/chapter';
import { diets } from '@/domain/recipe/diet';
import { reviewNoteFields, type ExtractedRecipe } from '@/domain/recipe/extracted-recipe';
import { holidays } from '@/domain/recipe/holiday';
import { AiPageRecipeExtractor } from '@/infrastructure/ai/ai-page-recipe-extractor';
import { AiScanRecipeExtractor } from '@/infrastructure/ai/ai-scan-recipe-extractor';
import { JsonLdPageRecipeExtractor } from '@/infrastructure/web/json-ld-page-recipe-extractor';
import { AppError } from '@/lib/errors';
import { getLogger } from '@/lib/logger';
import { scoredFields, scoreRecipe, type InventedField, type RecipeScore } from './score';

const casesFolder = path.join(import.meta.dirname, 'cases');

// Gateway ids: a fast and a strong vision model from each provider.
const defaultModels = [
	'anthropic/claude-haiku-5.5',
	'anthropic/claude-sonnet-5.5',
	'google/gemini-3.8-flash',
	'google/gemini-3.1-pro-preview',
	'openai/gpt-6-luna',
	'openai/gpt-6.1-sol',
];

// Labels the evaluation's calls as their own user in the Gateway's usage reports.
const evaluationRequester: ExtractionRequester = {
	memberId: memberIdSchema.parse('e28e5c2f-a0df-4f9d-aa42-7cee9029f250'),
};

// Calls in flight at once: few enough that a call's latency stays its model's own.
const concurrency = 4;

// The JSON-LD extractor reads each page once, since it reads a page the same way every time.
const jsonLdReader = 'json-ld';

const categories = ['handwritten', 'printed', 'page'] as const;
type Category = (typeof categories)[number];

const categoryTitles = {
	handwritten: 'Handwritten',
	printed: 'Printed',
	page: 'Pages',
} as const satisfies Record<Category, string>;

// Fields a model tends to work out rather than read, such as minutes from "Bake 20 min."
const statedOnlyFields: ReadonlySet<InventedField> = new Set([
	'yield',
	'prepMinutes',
	'cookMinutes',
	'totalMinutes',
]);

const caseDefinitionSchema = z.discriminatedUnion('kind', [
	z.strictObject({
		id: z.string(),
		kind: z.literal('scan'),
		files: z.array(z.string()).min(1),
		tags: z.array(z.string()),
	}),
	z.strictObject({
		id: z.string(),
		kind: z.literal('page'),
		files: z.tuple([z.string()]),
		url: z.url(),
		tags: z.array(z.string()),
	}),
]);
type CaseDefinition = z.infer<typeof caseDefinitionSchema>;

// Strict, so a misspelled key in an expected.json fails the run instead of going unscored. The filing
// is not scored, so a case may leave it out.
const expectedRecipeSchema = z.strictObject({
	title: z.string().optional(),
	description: z.string().optional(),
	notes: z.string().optional(),
	source: z.string().optional(),
	yield: z
		.strictObject({
			kind: z.enum(['servings', 'makes']),
			amount: z.string(),
			unit: z.string().optional(),
		})
		.optional(),
	times: z.strictObject({
		prepMinutes: z.number().optional(),
		cookMinutes: z.number().optional(),
		totalMinutes: z.number().optional(),
	}),
	ingredientSections: z.array(
		z.strictObject({ heading: z.string().optional(), lines: z.array(z.string()) })
	),
	instructionSections: z.array(
		z.strictObject({ heading: z.string().optional(), steps: z.array(z.string()) })
	),
	chapter: z.enum(chapters).optional(),
	holidays: z.array(z.enum(holidays)).default([]),
	diets: z.array(z.enum(diets)).default([]),
	reviewNotes: z.array(
		z.strictObject({
			field: z.enum(reviewNoteFields),
			section: z.number().optional(),
			line: z.number().optional(),
			note: z.string(),
		})
	),
}) satisfies z.ZodType<ExtractedRecipe>;

type CaseSource = { kind: 'scan'; scans: ScanImage[] } | { kind: 'page'; page: WebPage };

type EvaluationCase = {
	id: string;
	category: Category;
	expected: ExtractedRecipe;
	source: CaseSource;
};

type ModelReader = {
	model: string;
	scans: ScanRecipeExtractor;
	pages: PageRecipeExtractor;
};

type Call = {
	evaluationCase: EvaluationCase;
	// A model id, or json-ld.
	reader: string;
	run: number;
	extract: () => Promise<Extraction | null>;
};

type Answer = {
	kind: 'answered';
	extraction: Extraction | null;
	latencyMs: number;
};

type Failure = {
	kind: 'failed';
	code: string;
};

type CallResult = Call & {
	outcome: Answer | Failure;
	// Zero when the call failed or found no recipe.
	score: RecipeScore;
};

const logger = getLogger('evaluate');

function categoryOf(definition: CaseDefinition): Category {
	if (definition.kind === 'page') {
		return 'page';
	}
	if (definition.tags.includes('handwritten')) {
		return 'handwritten';
	}
	if (definition.tags.includes('printed')) {
		return 'printed';
	}
	throw new Error(`Scan case ${definition.id} is tagged neither handwritten nor printed`);
}

async function loadSource(definition: CaseDefinition, folder: string): Promise<CaseSource> {
	switch (definition.kind) {
		case 'scan':
			return {
				kind: 'scan',
				scans: await Promise.all(
					definition.files.map(async (file) => ({
						bytes: await readFile(path.join(folder, file)),
						mediaType: 'image/jpeg' as const,
					}))
				),
			};
		case 'page':
			return {
				kind: 'page',
				page: {
					url: definition.url,
					html: await readFile(path.join(folder, definition.files[0]), 'utf8'),
				},
			};
	}
}

async function loadCases(only: readonly string[] | undefined): Promise<EvaluationCase[]> {
	const definitions = z
		.array(caseDefinitionSchema)
		.parse(JSON.parse(await readFile(path.join(import.meta.dirname, 'cases.json'), 'utf8')));
	const unknown = only?.filter((id) => !definitions.some((definition) => definition.id === id));
	if (unknown !== undefined && unknown.length > 0) {
		throw new Error(`Unknown cases: ${unknown.join(', ')}`);
	}

	const chosen = definitions.filter((definition) => only?.includes(definition.id) ?? true);
	return Promise.all(
		chosen.map(async (definition) => {
			const folder = path.join(casesFolder, definition.id);
			const expected = expectedRecipeSchema.parse(
				JSON.parse(await readFile(path.join(folder, 'expected.json'), 'utf8'))
			);
			return {
				id: definition.id,
				category: categoryOf(definition),
				expected,
				source: await loadSource(definition, folder),
			};
		})
	);
}

function readWithModel(reader: ModelReader, source: CaseSource): Promise<Extraction | null> {
	switch (source.kind) {
		case 'scan':
			return reader.scans.extract(source.scans, evaluationRequester);
		case 'page':
			return reader.pages.extract(source.page, evaluationRequester);
	}
}

// Every page once through JSON-LD, then every case through every model in each run. Models alternate,
// so the calls in flight go to different providers.
function evaluationCalls(
	cases: readonly EvaluationCase[],
	models: readonly string[],
	runs: number
): Call[] {
	const jsonLd = new JsonLdPageRecipeExtractor();
	const readers = models.map((model): ModelReader => ({
		model,
		scans: new AiScanRecipeExtractor(model),
		pages: new AiPageRecipeExtractor(model),
	}));
	const runNumbers = Array.from({ length: runs }, (_, index) => index + 1);
	return [
		...cases.flatMap((evaluationCase) => {
			const { source } = evaluationCase;
			return source.kind === 'page'
				? [
						{
							evaluationCase,
							reader: jsonLdReader,
							run: 1,
							extract: () => jsonLd.extract(source.page),
						},
					]
				: [];
		}),
		...runNumbers.flatMap((run) =>
			cases.flatMap((evaluationCase) =>
				readers.map((reader) => ({
					evaluationCase,
					reader: reader.model,
					run,
					extract: () => readWithModel(reader, evaluationCase.source),
				}))
			)
		),
	];
}

// An extractor reports no recipe as null, or as a recipe without an ingredient or a step.
function recipeOf(extraction: Extraction | null): ExtractedRecipe | null {
	if (extraction === null) {
		return null;
	}
	const { ingredientSections, instructionSections } = extraction.recipe;
	const hasRecipe =
		ingredientSections.some((section) => section.lines.length > 0) ||
		instructionSections.some((section) => section.steps.length > 0);
	return hasRecipe ? extraction.recipe : null;
}

async function runCall(call: Call): Promise<CallResult> {
	const { evaluationCase } = call;
	const started = performance.now();
	try {
		const extraction = await call.extract();
		return {
			...call,
			outcome: { kind: 'answered', extraction, latencyMs: performance.now() - started },
			score: scoreRecipe(evaluationCase.expected, recipeOf(extraction)),
		};
	} catch (err) {
		logger.warn('Evaluation call failed', {
			caseId: evaluationCase.id,
			reader: call.reader,
			run: call.run,
			err,
		});
		return {
			...call,
			outcome: { kind: 'failed', code: err instanceof AppError ? err.code : 'unexpected' },
			score: scoreRecipe(evaluationCase.expected, null),
		};
	}
}

// Runs the calls a few at a time. The workers share one iterator, so each call runs once.
async function runCalls(calls: readonly Call[]): Promise<CallResult[]> {
	const results: CallResult[] = [];
	const pending = calls.entries();
	const worker = async () => {
		for (const [index, call] of pending) {
			results[index] = await runCall(call);
		}
	};
	await Promise.all(Array.from({ length: concurrency }, worker));
	return results;
}

function answerOf(result: CallResult): Answer | undefined {
	return result.outcome.kind === 'answered' ? result.outcome : undefined;
}

// The failure's code, "no recipe", or undefined when the call read a recipe.
function failureLabel(result: CallResult): string | undefined {
	const { outcome } = result;
	if (outcome.kind === 'failed') {
		return outcome.code;
	}
	return recipeOf(outcome.extraction) === null ? 'no recipe' : undefined;
}

function sum(values: readonly number[]): number {
	return values.reduce((total, value) => total + value, 0);
}

function mean(values: readonly number[]): number | undefined {
	return values.length === 0 ? undefined : sum(values) / values.length;
}

// The nearest-rank percentile.
function percentile(values: readonly number[], share: number): number | undefined {
	const sorted = values.toSorted((first, second) => first - second);
	return sorted[Math.max(Math.ceil(share * sorted.length) - 1, 0)];
}

// The mean, over cases read more than once, of the highest score less the lowest.
function runSpread(results: readonly CallResult[]): number | undefined {
	const byCase = Map.groupBy(results, (result) => result.evaluationCase.id);
	return mean(
		[...byCase.values()]
			.filter((caseResults) => caseResults.length > 1)
			.map((caseResults) => {
				const scores = caseResults.map((result) => result.score.score);
				return Math.max(...scores) - Math.min(...scores);
			})
	);
}

function formatScore(value: number | undefined): string {
	return value === undefined ? '-' : value.toFixed(3);
}

function formatSeconds(milliseconds: number | undefined): string {
	return milliseconds === undefined ? '-' : `${(milliseconds / 1000).toFixed(1)} s`;
}

function formatUsd(value: number | undefined, digits: number): string {
	return value === undefined ? '-' : `$${value.toFixed(digits)}`;
}

function formatFailures(results: readonly CallResult[]): string {
	const counts = new Map<string, number>();
	for (const result of results) {
		const label = failureLabel(result);
		if (label !== undefined) {
			counts.set(label, (counts.get(label) ?? 0) + 1);
		}
	}
	return counts.size === 0
		? 'none'
		: [...counts].map(([label, count]) => `${label} ${count}`).join(', ');
}

function table(header: readonly string[], rows: readonly (readonly string[])[]): string {
	const line = (cells: readonly string[]) => `| ${cells.join(' | ')} |`;
	return [line(header), line(header.map(() => '---')), ...rows.map(line)].join('\n');
}

function summaryRow(reader: string, results: readonly CallResult[]): string[] {
	const answers = results.flatMap((result) => answerOf(result) ?? []);
	const latencies = answers.map((answer) => answer.latencyMs);
	const costs = answers.flatMap((answer) => answer.extraction?.costUsd ?? []);
	const reviewNotes = answers.flatMap(
		(answer) => recipeOf(answer.extraction)?.reviewNotes.length ?? []
	);
	return [
		reader,
		...categories.map((category) =>
			formatScore(
				mean(
					results
						.filter((result) => result.evaluationCase.category === category)
						.map((result) => result.score.score)
				)
			)
		),
		formatScore(runSpread(results)),
		formatSeconds(mean(latencies)),
		formatSeconds(percentile(latencies, 0.9)),
		formatUsd(costs.length === 0 ? undefined : sum(costs), 2),
		formatUsd(mean(costs), 4),
		formatFailures(results),
		mean(reviewNotes)?.toFixed(1) ?? '-',
	];
}

function fieldsRow(reader: string, results: readonly CallResult[]): string[] {
	return [
		reader,
		...scoredFields.map((field) =>
			formatScore(mean(results.map((result) => result.score.fields[field])))
		),
	];
}

// Counted over the calls that read a recipe.
function signalsRow(reader: string, results: readonly CallResult[]): string[] {
	const scores = results
		.filter((result) => failureLabel(result) === undefined)
		.map((result) => result.score);
	const total = (count: (score: RecipeScore) => number) => String(sum(scores.map(count)));
	return [
		reader,
		total((score) => score.missedLines.length),
		total((score) => score.signals.unmatchedLines.length),
		total((score) => score.signals.numberMismatches.length),
		total(
			(score) =>
				score.signals.inventedFields.filter(({ field }) => statedOnlyFields.has(field)).length
		),
		total((score) => score.signals.inventedFields.length),
	];
}

function caseCell(results: readonly CallResult[]): string {
	return results.length === 0
		? '-'
		: results.map((result) => failureLabel(result) ?? result.score.score.toFixed(2)).join(' / ');
}

function signalDetail(result: CallResult): string | undefined {
	if (failureLabel(result) !== undefined) {
		return undefined;
	}
	const quoted = (text: string) => JSON.stringify(text);
	const { missedLines, signals } = result.score;
	const parts = [
		...signals.inventedFields.map(({ field, value }) => `invented ${field} ${quoted(value)}`),
		...missedLines.map((line) => `missed ${quoted(line)}`),
		...signals.unmatchedLines.map((line) => `extra ${quoted(line)}`),
		...signals.numberMismatches.map(
			({ expected, produced }) => `numbers ${quoted(expected)} read as ${quoted(produced)}`
		),
	];
	return parts.length === 0
		? undefined
		: `- ${result.evaluationCase.id}, ${result.reader}, run ${result.run}: ${parts.join('; ')}`;
}

function report(
	cases: readonly EvaluationCase[],
	readers: readonly string[],
	results: readonly CallResult[],
	runs: number
): string {
	const byReader = Map.groupBy(results, (result) => result.reader);
	const readerResults = (reader: string) => byReader.get(reader) ?? [];
	const otherModels = results.flatMap((result) => {
		const model = answerOf(result)?.extraction?.model;
		return model === undefined || model === result.reader
			? []
			: [`${result.evaluationCase.id} run ${result.run} (${result.reader} as ${model})`];
	});

	return [
		'# Import evaluation',
		`${cases.length} cases, ${runs} ${runs === 1 ? 'run' : 'runs'}, ${new Date().toISOString().slice(0, 10)}. Scores run from 0 to 1; a failure or no recipe scores 0. Latency and cost cover the calls that answered.`,
		'## Readers',
		table(
			[
				'Reader',
				...categories.map((category) => categoryTitles[category]),
				'Run spread',
				'Mean latency',
				'p90 latency',
				'Total cost',
				'Per import',
				'Failures',
				'Review notes',
			],
			readers.map((reader) => summaryRow(reader, readerResults(reader)))
		),
		otherModels.length === 0
			? 'Every model call was answered by the model asked.'
			: `Answered by another model: ${otherModels.join(', ')}.`,
		'## Fields',
		'Mean score of each field.',
		table(
			['Reader', ...scoredFields],
			readers.map((reader) => fieldsRow(reader, readerResults(reader)))
		),
		'## Signals',
		'Totals over the calls that read a recipe.',
		table(
			[
				'Reader',
				'Missed lines',
				'Extra lines',
				'Number mismatches',
				'Invented yield or times',
				'Invented fields',
			],
			readers.map((reader) => signalsRow(reader, readerResults(reader)))
		),
		'## Cases',
		"Each run's score, in run order.",
		table(
			['Case', 'Category', ...readers],
			cases.map((evaluationCase) => [
				evaluationCase.id,
				categoryTitles[evaluationCase.category],
				...readers.map((reader) =>
					caseCell(
						readerResults(reader).filter((result) => result.evaluationCase.id === evaluationCase.id)
					)
				),
			])
		),
		'## Signal details',
		results.flatMap((result) => signalDetail(result) ?? []).join('\n') || 'None.',
	].join('\n\n');
}

// Imported whole: @next/env is bundled CommonJS, whose named exports Node's ESM loader cannot see.
nextEnv.loadEnvConfig(process.cwd());

z.object({
	// The Gateway reads Vercel's OIDC token itself; a missing one stops the run before any call.
	VERCEL_OIDC_TOKEN: z.string().min(1),
}).parse(process.env);

const options = z
	.object({
		model: z.array(z.string().min(1)).default(defaultModels),
		case: z.array(z.string()).optional(),
		runs: z.coerce.number().int().positive(),
	})
	.parse(
		parseArgs({
			options: {
				// Each repeats: --model a --model b.
				model: { type: 'string', multiple: true },
				case: { type: 'string', multiple: true },
				runs: { type: 'string', default: '1' },
			},
		}).values
	);

try {
	const cases = await loadCases(options.case);
	const results = await runCalls(evaluationCalls(cases, options.model, options.runs));
	const readers = [...options.model, jsonLdReader];
	process.stdout.write(`${report(cases, readers, results, options.runs)}\n`);
} catch (err) {
	logger.error('Evaluation failed', { err });
	process.exitCode = 1;
}
