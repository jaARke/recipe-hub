import tailwindcss from '@tailwindcss/vite';
import { playwright } from '@vitest/browser-playwright';
import { configDefaults, defineConfig } from 'vitest/config';
import { vitestResultsDir } from './vitest.global-setup';

export default defineConfig({
	resolve: {
		// Next aliases server-only to this empty module for server code; Vitest has no such alias.
		alias: { 'server-only': 'next/dist/compiled/server-only/empty.js' },
		tsconfigPaths: true,
	},
	test: {
		globalSetup: './vitest.global-setup.ts',
		attachmentsDir: `${vitestResultsDir}/attachments`,
		// The defaults, which add GitHub's annotations and job summary in Actions, and one HTML file that
		// shows each failure with its screenshot.
		reporters: [
			...configDefaults.reporters,
			['html', { outputDir: `${vitestResultsDir}/report`, singleFile: true }],
		],
		// Component render tests are .test.tsx and run in real browsers; every other test runs in Node.
		projects: [
			{ extends: true, test: { name: 'node', include: ['**/*.test.ts'], environment: 'node' } },
			{
				extends: true,
				plugins: [tailwindcss()],
				// Next's bundler replaces process.env.* in client code, and the browser has no process.
				define: { 'process.env': '{}' },
				optimizeDeps: { rolldownOptions: { transform: { define: { 'process.env': '{}' } } } },
				resolve: {
					// next/image's CommonJS default would arrive whole, as Vite 8 imports CommonJS as Node does.
					alias: [
						{
							find: /^next\/image$/,
							replacement: 'next/dist/esm/shared/lib/image-external.js',
						},
					],
				},
				test: {
					name: 'browser',
					include: ['**/*.test.tsx'],
					setupFiles: ['./vitest.browser-setup.ts'],
					// After the Node tests rather than beside them, whose load slows real input past a test's bound.
					sequence: { groupOrder: 1 },
					browser: {
						enabled: true,
						// Vitest opens the browsers outside CI unless told otherwise.
						headless: true,
						provider: playwright(),
						instances: [{ browser: 'chromium' }, { browser: 'firefox' }, { browser: 'webkit' }],
						// A phone's, where Tailwind's unprefixed classes apply; a test of a wider layout sets its own.
						viewport: { width: 390, height: 844 },
					},
				},
			},
		],
	},
});
