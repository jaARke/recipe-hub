import { z } from 'zod';
import { BlobPreviewStore } from './blob-preview-store';
import { branchOutcomeSchema, clearPreviewFolders, previewFoldersReport } from './preview-folders';

// Set by the Preview cleanup workflow's images job (.github/workflows/preview-cleanup.yml).
const envSchema = z.object({
	PREVIEW_BLOB_TOKEN: z
		.string()
		.min(
			1,
			'Set the repository secret PREVIEW_BLOB_TOKEN to the read-write token of the Blob store recipe-hub-images-preview'
		),
	// The previews job's outputs: each branch it decided on as JSON, and when it listed the previews,
	// in milliseconds since the epoch.
	PREVIEW_OUTCOMES: z
		.string()
		.transform((text, context) => {
			try {
				return JSON.parse(text) as unknown;
			} catch {
				context.addIssue({ code: 'custom', message: 'Not JSON' });
				return z.NEVER;
			}
		})
		.pipe(z.array(branchOutcomeSchema)),
	LISTED_AT: z.coerce
		.number()
		.int()
		.positive()
		.transform((milliseconds) => new Date(milliseconds)),
	// The closed pull request's or the deleted branch's name; empty for the sweep.
	BRANCH: z.string().transform((branch) => (branch === '' ? undefined : branch)),
});

// Each line of the workflow's log; one starting ::error:: becomes an annotation on the run.
function print(text: string): void {
	if (text !== '') {
		process.stdout.write(`${text}\n`);
	}
}

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
	print(
		parsed.error.issues
			.map(({ path, message }) => `::error::${path.join('.')}: ${message}`)
			.join('\n')
	);
	process.exit(1);
}
const env = parsed.data;

try {
	const outcomes = await clearPreviewFolders(new BlobPreviewStore(env.PREVIEW_BLOB_TOKEN), {
		branches: env.PREVIEW_OUTCOMES,
		listedAt: env.LISTED_AT,
		eventBranch: env.BRANCH,
	});
	print(previewFoldersReport(outcomes, env.BRANCH));
	if (outcomes.some(({ kind }) => kind === 'failed')) {
		process.exitCode = 1;
	}
} catch (error) {
	print(`::error::Clearing the preview store's folders failed: ${String(error)}`);
	process.exitCode = 1;
}
