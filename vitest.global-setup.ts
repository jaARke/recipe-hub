import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { TestProject } from 'vitest/node';

// Where a run writes its failure screenshots and HTML report, beside Playwright's results.
export const vitestResultsDir = 'test-results/vitest';

// Vitest keeps a failure's screenshot until that test fails again, so each run starts from an empty
// folder, as Playwright's does.
export default async function emptyResults(project: TestProject): Promise<void> {
	await rm(resolve(project.config.root, vitestResultsDir), { recursive: true, force: true });
}
