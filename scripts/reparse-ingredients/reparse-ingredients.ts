import { parseArgs } from 'node:util';
import nextEnv from '@next/env';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { z } from 'zod';
import { pinFullSslVerification } from '@/infrastructure/db/connection-string';
import { DrizzleRecipeRepository } from '@/infrastructure/db/drizzle-recipe-repository';
import { poolDeadlines } from '@/infrastructure/db/pool-deadlines';
import { getLogger } from '@/lib/logger';
import { reparseIngredients, reparseReport } from './reparse';

const logger = getLogger('reparse-ingredients');

// Imported whole: @next/env is bundled CommonJS, whose named exports Node's ESM loader cannot see.
// It never replaces a variable already set, so tsx's --env-file can point the run at another database.
nextEnv.loadEnvConfig(process.cwd());

const env = z
	.object({
		// The re-parse takes a direct connection, as migrations do, not the pooler.
		DATABASE_URL_UNPOOLED: z.url(),
	})
	.parse(process.env);

const { values: options } = parseArgs({
	options: {
		// Without it, a dry run that writes nothing.
		write: { type: 'boolean', default: false },
	},
});

const connectionString = pinFullSslVerification(env.DATABASE_URL_UNPOOLED);
const pool = new Pool({ connectionString, ...poolDeadlines });
try {
	// The host tells production's database from develop's before anything is read.
	logger.info('Ingredient re-parse started', {
		write: options.write,
		databaseHost: new URL(connectionString).hostname,
	});
	const result = await reparseIngredients(new DrizzleRecipeRepository(drizzle({ client: pool })), {
		write: options.write,
	});
	process.stdout.write(`${reparseReport(result)}\n`);
} catch (err) {
	logger.error('Ingredient re-parse failed', { err });
	process.exitCode = 1;
} finally {
	await pool.end();
}
