import { sql } from 'drizzle-orm';
import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const recipes = pgTable('recipes', {
	id: uuid('id')
		.primaryKey()
		.default(sql`uuidv7()`),
	slug: text('slug').notNull().unique(),
	// No foreign key until the member table exists.
	contributorId: uuid('contributor_id').notNull(),
	// The JSON columns are untyped because the mapper validates every read. Content excludes tags.
	content: jsonb('content').notNull(),
	provenance: jsonb('provenance').notNull(),
	tags: text('tags').array().notNull().default([]),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
