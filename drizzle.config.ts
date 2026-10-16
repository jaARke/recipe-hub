import { loadEnvConfig } from '@next/env';
import { defineConfig } from 'drizzle-kit';
import { z } from 'zod';
import {
	guardProductionDatabase,
	pinFullSslVerification,
	productionDatabaseGuardEnvSchema,
} from './src/infrastructure/db/connection-string';

loadEnvConfig(process.cwd());

// Only migrate connects, so generate and check run without database variables, as in CI.
const env = z
	.object({
		DATABASE_URL_UNPOOLED: z.url().optional(),
		...productionDatabaseGuardEnvSchema.shape,
	})
	.parse(process.env);

// Migrations take a direct connection, not the pooler.
const connectionString =
	env.DATABASE_URL_UNPOOLED === undefined
		? undefined
		: pinFullSslVerification(env.DATABASE_URL_UNPOOLED);

if (connectionString !== undefined) {
	guardProductionDatabase(connectionString, env);
	// drizzle-kit loads this file outside Next and the scripts' tsconfig, where the logger's
	// server-only import cannot resolve, so the host is printed as drizzle-kit prints its own lines.
	console.info(`Database host '${new URL(connectionString).hostname}'`);
}

export default defineConfig({
	dialect: 'postgresql',
	schema: './src/infrastructure/db/schema.ts',
	out: './src/infrastructure/db/migrations',
	strict: true,
	...(connectionString !== undefined && { dbCredentials: { url: connectionString } }),
});
