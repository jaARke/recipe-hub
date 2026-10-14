import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import perfectionist from 'eslint-plugin-perfectionist';

const logMessageRestriction = {
	selector:
		"CallExpression[callee.object.name='logger'][callee.property.name=/^(info|warn|error)$/][arguments.0.type!='Literal']",
	message: 'Log a constant message and put values in the fields argument.',
};

const actionStateMessage =
	'Call useFormAction from src/components/forms/use-form-action.ts, so what an attempt said lasts only while its page is shown.';

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
	{
		files: ['**/*.{js,mjs,cjs,ts,tsx}'],
		rules: {
			'no-restricted-properties': [
				'error',
				{
					object: 'process',
					property: 'env',
					message: 'Read configuration from src/lib/env.ts instead of process.env.',
				},
				{
					object: 'globalThis',
					property: 'process',
					message: 'Read configuration from src/lib/env.ts instead of process.env.',
				},
				{ object: 'React', property: 'useActionState', message: actionStateMessage },
			],
			'no-restricted-imports': [
				'error',
				{
					paths: [
						{
							name: 'process',
							message: 'Read configuration from src/lib/env.ts instead of process.env.',
						},
						{
							name: 'node:process',
							message: 'Read configuration from src/lib/env.ts instead of process.env.',
						},
					],
				},
			],
		},
	},
	{
		files: ['src/**/*.{ts,tsx}', 'scripts/**/*.ts'],
		rules: {
			// A namespace import of React is everywhere, and no-restricted-imports would refuse it along
			// with the named import, so the named import is matched here.
			'no-restricted-syntax': [
				'error',
				logMessageRestriction,
				{
					selector:
						"ImportDeclaration[source.value='react'] > ImportSpecifier[imported.name='useActionState']",
					message: actionStateMessage,
				},
			],
		},
	},
	{
		// The one caller of useActionState. A later block replaces a rule's options rather than merging
		// them, so this one restates the rest.
		files: ['src/components/forms/use-form-action.ts'],
		rules: { 'no-restricted-syntax': ['error', logMessageRestriction] },
	},
	{
		// Entry points outside Next read their own variables: drizzle-kit's config and tsx scripts.
		files: ['src/lib/env.ts', 'drizzle.config.ts', 'scripts/**/*.ts'],
		rules: { 'no-restricted-properties': 'off', 'no-restricted-imports': 'off' },
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
