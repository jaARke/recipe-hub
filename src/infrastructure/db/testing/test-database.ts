import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { unaccent } from '@electric-sql/pglite/contrib/unaccent';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';

const migrationsFolder = path.join(import.meta.dirname, '../migrations');

export type TestDatabase = Awaited<ReturnType<typeof createTestDatabase>>;

// An in-memory Postgres built by the real migrations, so tests also exercise the migration SQL.
export async function createTestDatabase() {
	const db = drizzle({ client: new PGlite({ extensions: { pg_trgm, unaccent } }) });
	await migrate(db, { migrationsFolder });
	return db;
}
