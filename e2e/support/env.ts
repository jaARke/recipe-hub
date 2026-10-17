import nextEnv from '@next/env';
import { z } from 'zod';
import { productionDatabaseGuardEnvSchema } from '@/lib/production-database-guard';

// Loaded as `next dev` loads it, so the suites share the dev server's database and secret. Imported
// whole: @next/env is bundled CommonJS, whose named exports Node's ESM loader cannot see.
nextEnv.loadEnvConfig(process.cwd(), true);

// The variables the suites read. Production's endpoint id is required, so the production guard
// always has an endpoint to refuse.
export const endToEndEnv = z
	.object({
		// The suites' own connection is direct, as the scripts' are, not the pooler.
		DATABASE_URL_UNPOOLED: z.url(),
		// The dev server's, which signs the session cookies the suites mint.
		BETTER_AUTH_SECRET: z.string().min(32),
		...productionDatabaseGuardEnvSchema.shape,
		NEON_PRODUCTION_ENDPOINT_ID:
			productionDatabaseGuardEnvSchema.shape.NEON_PRODUCTION_ENDPOINT_ID.unwrap(),
	})
	.refine((vars) => vars.VERCEL_ENV !== 'production', {
		message: 'The end-to-end suites run against development, never production',
		path: ['VERCEL_ENV'],
	})
	.parse(process.env);
