import 'server-only';
import { attachDatabasePool } from '@vercel/functions';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { pinFullSslVerification } from '@/infrastructure/db/connection-string';
import { printQueryErrorsWithoutParameters } from '@/infrastructure/db/query-errors';
import { env } from '@/lib/env';
import { getLogger } from '@/lib/logger';

const logger = getLogger('db');

printQueryErrorsWithoutParameters();

const pool = new Pool({
	connectionString: pinFullSslVerification(env.DATABASE_URL),
	// Short, so idle connections close before a Fluid compute instance suspends.
	idleTimeoutMillis: 5000,
});

// The pool drops a failed idle client and connects afresh; without a listener the error would crash.
pool.on('error', (err) => {
	logger.warn('Idle database connection failed', { err });
});

attachDatabasePool(pool);

export const db = drizzle({ client: pool });
