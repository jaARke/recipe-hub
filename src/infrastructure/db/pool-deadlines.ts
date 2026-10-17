import 'server-only';
import type { PoolConfig } from 'pg';
import { statementTimeoutMs } from '@/infrastructure/db/bounded-transaction';

// The deadlines every pool on the app's database keeps: the app's own (client.ts) and the end-to-end
// suites' (e2e/support/develop-database.ts).
export const poolDeadlines = {
	// Neon's own example for node-postgres, long enough for a compute waking from zero. The pool waits
	// no longer than this for a free connection either.
	connectionTimeoutMillis: 10_000,
	// The client's wait on any one query, 5 seconds past the statement bound a bounded transaction
	// gives Postgres, so Postgres cancels first and the connection stays usable. A statement outside a
	// transaction has this bound alone: Neon's pooler ignores statement_timeout as a startup parameter.
	query_timeout: statementTimeoutMs + 5_000,
} as const satisfies PoolConfig;
