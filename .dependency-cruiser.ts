import type { IConfiguration } from 'dependency-cruiser';

const TESTS = '\\.test\\.tsx?$';
const TEST_SUPPORT = `${TESTS}|(^|/)testing/`;
const PURE_LIB = '^src/lib/(?!env\\.ts$|logger\\.ts$)';
const LIB_WITHOUT_ENV = '^src/lib/(?!env\\.ts$)';
const NODE_MODULES = '(^|/)node_modules/';

const config: IConfiguration = {
	forbidden: [
		{
			name: 'resolvable-imports',
			comment: 'Every import must resolve; server-only is resolved by Next and not installed.',
			severity: 'error',
			from: {},
			to: { couldNotResolve: true, pathNot: '^server-only$' },
		},
		{
			name: 'no-circular',
			comment: 'Modules must not depend on each other in a cycle.',
			severity: 'error',
			from: {},
			to: { circular: true },
		},
		{
			name: 'domain-is-pure',
			comment: 'Domain imports only domain, pure src/lib helpers, and zod.',
			severity: 'error',
			from: { path: '^src/domain/', pathNot: TESTS },
			to: {
				pathNot: ['^src/domain/', PURE_LIB, `${NODE_MODULES}zod/`, `${NODE_MODULES}vitest/`],
			},
		},
		{
			name: 'application-depends-inward',
			comment:
				'Application imports only application, domain, src/lib without env, zod, and server-only.',
			severity: 'error',
			from: { path: '^src/application/', pathNot: TESTS },
			to: {
				pathNot: [
					'^src/application/',
					'^src/domain/',
					LIB_WITHOUT_ENV,
					`${NODE_MODULES}zod/`,
					`${NODE_MODULES}vitest/`,
					'^server-only$',
				],
			},
		},
		{
			name: 'infrastructure-stays-below-composition-and-presentation',
			comment: 'Infrastructure implements ports and never reaches composition or presentation.',
			severity: 'error',
			from: { path: '^src/infrastructure/' },
			to: { path: '^src/(composition|app|components)/' },
		},
		{
			name: 'composition-stays-below-presentation',
			comment: 'Composition wires adapters and never reaches presentation.',
			severity: 'error',
			from: { path: '^src/composition/' },
			to: { path: '^src/(app|components)/' },
		},
		{
			name: 'presentation-not-infrastructure',
			comment: 'Presentation obtains adapters through composition, never directly.',
			severity: 'error',
			from: { path: '^src/(app|components)/' },
			to: { path: '^src/infrastructure/' },
		},
		{
			name: 'components-not-composition',
			comment: 'Components receive data as props and never call services.',
			severity: 'error',
			from: { path: '^src/components/' },
			to: { path: '^src/composition/' },
		},
		{
			name: 'lib-is-shared',
			comment: 'src/lib depends on no other layer.',
			severity: 'error',
			from: { path: '^src/lib/' },
			to: { path: '^src/(domain|application|infrastructure|composition|app|components)/' },
		},
		{
			name: 'testing-kits-only-in-tests',
			comment: 'Test kits are imported only by tests and other test kits.',
			severity: 'error',
			from: { pathNot: TEST_SUPPORT },
			to: { path: '(^|/)testing/' },
		},
		{
			name: 'vitest-only-in-tests',
			comment: 'Vitest is imported only by tests and test kits.',
			severity: 'error',
			from: { pathNot: TEST_SUPPORT },
			to: { path: `${NODE_MODULES}vitest/` },
		},
	],
	required: [
		{
			name: 'server-modules-import-server-only',
			comment: 'Server layers import server-only, except files drizzle-kit loads outside Next.',
			severity: 'error',
			module: {
				path: '^src/(application|infrastructure|composition)/.+\\.tsx?$',
				pathNot: [TEST_SUPPORT, '^src/infrastructure/db/(schema|connection-string)\\.ts$'],
			},
			to: { path: '^server-only$' },
		},
	],
	options: {
		tsPreCompilationDeps: true,
		detectImportsInAmbientModules: true,
		tsConfig: { fileName: 'tsconfig.json' },
		enhancedResolveOptions: {
			exportsFields: ['exports'],
			conditionNames: ['import', 'types', 'node', 'default'],
		},
		doNotFollow: { path: 'node_modules' },
	},
};

export default config;
