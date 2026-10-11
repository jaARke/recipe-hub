import { defineConfig } from 'vitest/config';

export default defineConfig({
	resolve: {
		// Next aliases server-only to this empty module for server code; Vitest has no such alias.
		alias: { 'server-only': 'next/dist/compiled/server-only/empty.js' },
		tsconfigPaths: true,
	},
});
