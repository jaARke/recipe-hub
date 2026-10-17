import 'server-only';
import { attachDatabasePool } from '@vercel/functions';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { pinFullSslVerification } from '@/infrastructure/db/connection-string';
import { poolDeadlines } from '@/infrastructure/db/pool-deadlines';
import { printQueryErrorsWithoutParameters } from '@/infrastructure/db/query-errors';
import { env } from '@/lib/env';
import { getLogger } from '@/lib/logger';
import { guardProductionDatabase } from '@/lib/production-database-guard';

const logger = getLogger('db');

// Short on a deployment, so idle connections close before a Fluid compute instance suspends. The dev
// server, outside Neon's region, keeps them for minutes, as each new one costs a third of a second,
// and still closes them before Neon's five-minute scale to zero.
const idleTimeoutMs = env.NODE_ENV === 'development' ? 240_000 : 5_000;

printQueryErrorsWithoutParameters();

const connectionString = pinFullSslVerification(env.DATABASE_URL);

// As the module loads, before any pool exists, as each build step checks its own connection: a
// preview's build then fails before it renders, and a running preview fails every query rather than
// reach production.
guardProductionDatabase(connectionString, env);

const pool = new Pool({
	connectionString,
	idleTimeoutMillis: idleTimeoutMs,
	...poolDeadlines,
});

// The pool drops a failed idle client and connects afresh; without a listener the error would crash.
pool.on('error', (err) => {
	logger.warn('Idle database connection failed', { err });
});

attachDatabasePool(pool);

export const db = drizzle({ client: pool });
