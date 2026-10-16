import { z } from 'zod';

// The variables guardProductionDatabase reads, which src/lib/env.ts and each build step parse along
// with their own. drizzle-kit loads this module outside Next, so it imports nothing but zod.
export const productionDatabaseGuardEnvSchema = z.object({
	// Set by Vercel on deployments; absent when Next.js or a script runs directly.
	VERCEL_ENV: z.enum(['development', 'preview', 'production']).optional(),
	// Production's Neon endpoint id, which its direct host begins with: ep-..., never the pooler's.
	NEON_PRODUCTION_ENDPOINT_ID: z
		.string()
		.regex(/^ep-[a-z0-9-]+(?<!-pooler)$/)
		.optional(),
});

export type ProductionDatabaseGuardEnv = z.infer<typeof productionDatabaseGuardEnvSchema>;

// A Neon host's first label is its endpoint id, or the id with a suffix: -pooler for the pooled host,
// and a compute's own binding (such as -bph) for the compute's direct and pooled hosts.
function isNeonEndpointHost(hostname: string, endpointId: string): boolean {
	const [firstLabel = ''] = hostname.split('.');
	return firstLabel === endpointId || firstLabel.startsWith(`${endpointId}-`);
}

// Throws unless the app's pool or a build step may open this database. A preview whose own Neon
// branch was not injected falls back to the Preview variables, which hold production's, so outside
// production production's endpoint is refused, and a preview must name it.
export function guardProductionDatabase(
	connectionString: string,
	env: ProductionDatabaseGuardEnv
): void {
	if (env.VERCEL_ENV === 'production') {
		return;
	}

	if (env.NEON_PRODUCTION_ENDPOINT_ID === undefined) {
		if (env.VERCEL_ENV === 'preview') {
			throw new Error(
				"NEON_PRODUCTION_ENDPOINT_ID must be set on Preview, naming production's Neon endpoint, so a preview can refuse production's database"
			);
		}
		return;
	}

	const { hostname } = new URL(connectionString);
	if (isNeonEndpointHost(hostname, env.NEON_PRODUCTION_ENDPOINT_ID)) {
		throw new Error(
			`Refusing production's database (${hostname}) with VERCEL_ENV ${env.VERCEL_ENV ?? 'unset'}: on a preview, Neon's integration did not give the deployment its own branch`
		);
	}
}
