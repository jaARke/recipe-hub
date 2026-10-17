import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { pinFullSslVerification } from '@/infrastructure/db/connection-string';
import { guardProductionDatabase } from '@/lib/production-database-guard';
import { endToEndEnv } from './env';

export type DevelopDatabase = {
	db: NodePgDatabase;
	close(): Promise<void>;
};

// The dev server's database, which the suites seed and clean up; production's is refused.
export function openDevelopDatabase(): DevelopDatabase {
	const connectionString = pinFullSslVerification(endToEndEnv.DATABASE_URL_UNPOOLED);
	guardProductionDatabase(connectionString, endToEndEnv);
	const pool = new Pool({ connectionString });
	return { db: drizzle({ client: pool }), close: () => pool.end() };
}
