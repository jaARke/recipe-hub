import { defineConfig, devices, type Project } from '@playwright/test';
import { devServerUrl } from './e2e/support/dev-server';

// What a test spends, by the tag it carries. Such a test runs only in its own project, named on the
// command line (`pnpm test:e2e --project=email`), and every other project leaves it out.
const spendingTags = { email: '@email' } as const;

const spendingTestTitle = new RegExp(Object.values(spendingTags).join('|'));

// The phones and the desktop the suites run on, each after the setup project's checks.
const deviceProjects: Project[] = [
	{ name: 'iphone', use: devices['iPhone 17'] },
	{ name: 'pixel', use: devices['Pixel 10'] },
	{ name: 'desktop', use: devices['Desktop Chrome'] },
].map((project) => ({
	...project,
	testMatch: '**/*.spec.ts',
	grepInvert: spendingTestTitle,
	dependencies: ['setup'],
}));

const spendingProjects: Project[] = Object.entries(spendingTags).map(([name, tag]) => ({
	name,
	use: devices['Desktop Chrome'],
	testMatch: '**/*.spec.ts',
	grep: new RegExp(tag),
	dependencies: ['setup'],
	default: false,
}));

// Where a run writes its traces and HTML report, beside Vitest's results. The two are siblings, since
// Playwright empties its output as a run starts and the report as it is written.
const resultsDir = 'test-results/playwright';

// As Next's own Playwright example allows: a cold `next dev` compiles the first page it serves.
const devServerStartTimeoutMs = 120_000;

// Long enough for `next dev` to stop its workers before it is killed.
const devServerShutdownTimeoutMs = 5_000;

// Run against `pnpm dev` from this tree on Neon develop: the one already serving, or one started for
// the run and stopped after it. A production build breaks BotID and /design, so it is never the target.
export default defineConfig({
	testDir: './e2e',
	// Resolves server-only, which the suites' Better Auth instance imports, as the scripts do.
	tsconfig: './e2e/tsconfig.json',
	fullyParallel: true,
	outputDir: `${resultsDir}/output`,
	reporter: [['list'], ['html', { open: 'never', outputFolder: `${resultsDir}/report` }]],
	webServer: {
		// Named, so a busy port fails the run rather than moving a second server to another port, where
		// sessions are not read.
		command: `pnpm dev --port ${devServerUrl.port}`,
		// Whatever listens on the port is reused, even a server answering 500, which a check by URL would
		// take for none and start a second `next dev` beside. The suites never run in CI.
		port: Number(devServerUrl.port),
		reuseExistingServer: true,
		timeout: devServerStartTimeoutMs,
		gracefulShutdown: { signal: 'SIGTERM', timeout: devServerShutdownTimeoutMs },
	},
	use: {
		baseURL: devServerUrl.href,
		trace: 'retain-on-failure',
	},
	projects: [{ name: 'setup', testMatch: '*.setup.ts' }, ...deviceProjects, ...spendingProjects],
});
