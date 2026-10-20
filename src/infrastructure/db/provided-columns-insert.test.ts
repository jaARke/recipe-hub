import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { insertProvidedColumns } from '@/infrastructure/db/provided-columns-insert';
import { createTestDatabase, type TestDatabase } from '@/infrastructure/db/testing/test-database';

// Declares a column the table the tests create lacks, as a deployment's schema does while the next
// deployment's migration drops it.
const scratch = pgTable('scratch', {
	id: uuid('id')
		.primaryKey()
		.default(sql`uuidv7()`),
	name: text('name').notNull(),
	note: text('note').notNull().default('none'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	dropped: text('dropped'),
});

const uuidV7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

let db: TestDatabase;

beforeEach(async () => {
	db = await createTestDatabase();
	await db.execute(
		sql`create table scratch (id uuid primary key default uuidv7(), name text not null, note text not null default 'none', created_at timestamptz not null default now())`
	);
});

afterEach(async () => {
	await db.$client.close();
});

describe('insertProvidedColumns', () => {
	it('inserts a row into a table without a column the schema declares, and returns it decoded', async () => {
		const row = await insertProvidedColumns(
			db,
			scratch,
			{ name: 'Biscuits' },
			{ id: scratch.id, name: scratch.name, note: scratch.note, createdAt: scratch.createdAt }
		);

		expect(row).toEqual({
			id: expect.stringMatching(uuidV7),
			name: 'Biscuits',
			note: 'none',
			createdAt: expect.any(Date),
		});
	});
});
