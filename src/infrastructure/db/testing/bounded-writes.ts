import { sql } from 'drizzle-orm';
import type { TestDatabase } from '@/infrastructure/db/testing/test-database';

// Refuses any row the tables are given outside a bounded transaction, where Postgres bounds every lock
// wait and statement, as a write whose waits are unbounded would be.
export async function requireBoundedWrites(db: TestDatabase, ...tables: string[]): Promise<void> {
	await db.execute(
		sql.raw(`create function require_bounded_writes() returns trigger language plpgsql as $$
begin
	if current_setting('lock_timeout') = '0' or current_setting('statement_timeout') = '0' then
		raise exception 'written outside a bounded transaction';
	end if;
	return new;
end
$$`)
	);
	for (const table of tables) {
		await db.execute(
			sql.raw(
				`create trigger require_bounded_writes before insert or update on ${table} for each row execute function require_bounded_writes()`
			)
		);
	}
}
