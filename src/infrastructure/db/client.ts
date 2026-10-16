import 'server-only';
import { attachDatabasePool } from '@vercel/functions';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { statementTimeoutMs } from '@/infrastructure/db/bounded-transaction';
import { pinFullSslVerification } from '@/infrastructure/db/connection-string';
import { printQueryErrorsWithoutParameters } from '@/infrastructure/db/query-errors';
import { env } from '@/lib/env';
import { getLogger } from '@/lib/logger';

const logger = getLogger('db');

// Neon's own example for node-postgres, long enough for a compute waking from zero. The pool waits
// no longer than this for a free connection either.
const connectionTimeoutMs = 10_000;

// The client's wait on any one query, 5 seconds past the statement bound a bounded transaction gives
// Postgres, so Postgres cancels first and the connection stays usable. A statement outside a
// transaction has this bound alone: Neon's pooler ignores statement_timeout as a startup parameter.
const queryTimeoutMs = statementTimeoutMs + 5_000;

printQueryErrorsWithoutParameters();

const pool = new Pool({
	connectionString: pinFullSslVerification(env.DATABASE_URL),
	// Short, so idle connections close before a Fluid compute instance suspends.
	idleTimeoutMillis: 5000,
	connectionTimeoutMillis: connectionTimeoutMs,
	query_timeout: queryTimeoutMs,
});

// The pool drops a failed idle client and connects afresh; without a listener the error would crash.
pool.on('error', (err) => {
	logger.warn('Idle database connection failed', { err });
});

attachDatabasePool(pool);

export const db = drizzle({ client: pool });
