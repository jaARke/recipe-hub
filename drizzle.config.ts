import { loadEnvConfig } from '@next/env';
import { defineConfig } from 'drizzle-kit';
import { z } from 'zod';
import { pinFullSslVerification } from './src/infrastructure/db/connection-string';

loadEnvConfig(process.cwd());

// Only migrate connects, so generate and check run without database variables, as in CI.
const env = z.object({ DATABASE_URL_UNPOOLED: z.url().optional() }).parse(process.env);

export default defineConfig({
	dialect: 'postgresql',
	schema: './src/infrastructure/db/schema.ts',
	out: './src/infrastructure/db/migrations',
	strict: true,
	// Migrations take a direct connection, not the pooler.
	...(env.DATABASE_URL_UNPOOLED !== undefined && {
		dbCredentials: { url: pinFullSslVerification(env.DATABASE_URL_UNPOOLED) },
	}),
});
