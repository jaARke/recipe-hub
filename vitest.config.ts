import { defineConfig } from 'vitest/config';

export default defineConfig({
	resolve: {
		// Next aliases server-only to this empty module for server code; Vitest has no such alias.
		alias: { 'server-only': 'next/dist/compiled/server-only/empty.js' },
		tsconfigPaths: true,
	},
	test: {
		// Component render tests are .test.tsx and run in a DOM; every other test runs in Node.
		projects: [
			{ extends: true, test: { name: 'node', include: ['**/*.test.ts'], environment: 'node' } },
			{
				extends: true,
				test: {
					name: 'dom',
					include: ['**/*.test.tsx'],
					environment: 'happy-dom',
					setupFiles: ['./vitest.dom-setup.ts'],
				},
			},
		],
	},
});
