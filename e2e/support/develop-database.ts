import { inspect } from 'node:util';
import { DrizzleQueryError } from 'drizzle-orm/errors';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { pinFullSslVerification } from '@/infrastructure/db/connection-string';
import { poolDeadlines } from '@/infrastructure/db/pool-deadlines';
import { printableQueryError } from '@/infrastructure/db/query-errors';
import { getLogger } from '@/lib/logger';
import { guardProductionDatabase } from '@/lib/production-database-guard';
import { endToEndEnv } from './env';

const logger = getLogger('e2e');

export type DevelopDatabase = {
	db: NodePgDatabase;
	close(): Promise<void>;
};

// The dev server's database, which the suites seed and clean up; production's is refused. Its pool
// keeps the app's deadlines, so a stalled connection or query fails the test rather than hangs it.
export function openDevelopDatabase(): DevelopDatabase {
	const connectionString = pinFullSslVerification(endToEndEnv.DATABASE_URL_UNPOOLED);
	guardProductionDatabase(connectionString, endToEndEnv);
	const pool = new Pool({ connectionString, ...poolDeadlines });
	// As the app's pool: it drops a failed idle client, and without a listener the error would crash
	// the worker.
	pool.on('error', (err) => {
		logger.warn('Idle database connection failed', { err });
	});
	return { db: drizzle({ client: pool }), close: () => pool.end() };
}

// A failed query as the app prints one, without its parameters. Playwright shows a cause only when it
// is an Error, so the fields of the query's cause, which name what failed, join the message.
function reportableQueryError(error: DrizzleQueryError): Error {
	const printable = printableQueryError(error);
	if (printable.cause === undefined) {
		return printable;
	}
	const cause = inspect(printable.cause, { breakLength: Infinity });
	const message = `${printable.message}\n[cause]: ${cause}`;
	const reportable = new Error(message);
	reportable.stack = printable.stack?.replace(printable.message, message);
	return reportable;
}

// The error with the failed query it is, or has among its causes, made reportable.
function withReportableQueryError(error: unknown): unknown {
	if (error instanceof DrizzleQueryError) {
		return reportableQueryError(error);
	}
	if (error instanceof Error && error.cause !== undefined) {
		error.cause = withReportableQueryError(error.cause);
	}
	return error;
}

// Runs database work for a suite and rethrows its failure without any query's parameters, a new
// session's token among them: Playwright's report, trace, and error context copy an error's message
// and stack, and each cause's. Every function in e2e/support that queries runs its work through this.
export async function reportQueryErrorsWithoutParameters<T>(work: () => Promise<T>): Promise<T> {
	try {
		return await work();
	} catch (error) {
		throw withReportableQueryError(error);
	}
}
