import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import perfectionist from 'eslint-plugin-perfectionist';

const eslintConfig = defineConfig([
	...nextVitals,
	...nextTs,
	{
		files: ['**/*.ts', '**/*.tsx'],
		plugins: { perfectionist },
		rules: {
			'perfectionist/sort-imports': [
				'error',
				{
					type: 'alphabetical',
					groups: ['builtin', 'external', 'internal', ['parent', 'sibling', 'index']],
					newlinesBetween: 0,
					// A comment ends a run of sorted imports, so a file's header comment stays at the top.
					partitionByComment: true,
				},
			],
			'perfectionist/sort-named-imports': [
				'error',
				{ type: 'alphabetical', groups: ['value-import', 'type-import'], ignoreAlias: true },
			],
		},
	},
	// Override default ignores of eslint-config-next.
	globalIgnores([
		// Default ignores of eslint-config-next:
		'.next/**',
		'out/**',
		'build/**',
		'next-env.d.ts',
	]),
]);

export default eslintConfig;
