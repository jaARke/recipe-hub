import { sql, type SQL } from 'drizzle-orm';
import {
	bigint,
	customType,
	index,
	jsonb,
	pgTable,
	text,
	timestamp,
	uuid,
} from 'drizzle-orm/pg-core';

// English stemming that ignores accents, shared by the search vector and every text search query.
export const recipeSearchConfiguration = sql.raw(`'public.recipe_english'::regconfig`);

const tsvector = customType<{ data: string }>({
	dataType() {
		return 'tsvector';
	},
});

export const recipes = pgTable(
	'recipes',
	{
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
		// Postgres derives the columns below from the content for search, and recipe reads leave them out.
		searchVector: tsvector('search_vector')
			.notNull()
			.generatedAlwaysAs(
				(): SQL =>
					sql`setweight(to_tsvector(${recipeSearchConfiguration}, ${recipes.content} ->> 'title'), 'A')
	|| setweight(to_tsvector(${recipeSearchConfiguration}, jsonb_path_query_array(${recipes.content}, '$.ingredientSections[*].lines[*].item')), 'B')
	|| setweight(to_tsvector(${recipeSearchConfiguration}, public.immutable_array_to_string(${recipes.tags}, ' ')), 'B')
	|| setweight(to_tsvector(${recipeSearchConfiguration}, jsonb_path_query_array(${recipes.content}, '$.description') || jsonb_path_query_array(${recipes.content}, '$.notes') || jsonb_path_query_array(${recipes.content}, '$.source')), 'C')
	|| setweight(to_tsvector(${recipeSearchConfiguration}, jsonb_path_query_array(${recipes.content}, '$.instructionSections[*].steps[*].text')), 'D')`
			),
		// The words close matches compare: the title, ingredient items, and tags.
		searchWords: text('search_words')
			.notNull()
			.generatedAlwaysAs(
				(): SQL =>
					sql`lower(public.immutable_unaccent((${recipes.content} ->> 'title') || ' ' || jsonb_path_query_array(${recipes.content}, '$.ingredientSections[*].lines[*].item')::text || ' ' || public.immutable_array_to_string(${recipes.tags}, ' ')))`
			),
		tagKeys: text('tag_keys')
			.array()
			.notNull()
			.generatedAlwaysAs((): SQL => sql`public.search_keys(${recipes.tags})`),
		sourceKey: text('source_key').generatedAlwaysAs(
			(): SQL => sql`public.search_key(${recipes.content} ->> 'source')`
		),
		// Matches the domain's totalMinutes: a stated total wins, otherwise prep plus cook. A bigint holds
		// every duration the domain accepts, which a 32-bit integer would not.
		totalMinutes: bigint('total_minutes', { mode: 'number' }).generatedAlwaysAs(
			(): SQL =>
				sql`coalesce((${recipes.content} #>> '{times,totalMinutes}')::bigint, (${recipes.content} #>> '{times,prepMinutes}')::bigint + (${recipes.content} #>> '{times,cookMinutes}')::bigint, (${recipes.content} #>> '{times,prepMinutes}')::bigint, (${recipes.content} #>> '{times,cookMinutes}')::bigint)`
		),
		titleSort: text('title_sort')
			.notNull()
			.generatedAlwaysAs(
				(): SQL =>
					sql`lower(public.immutable_unaccent(${recipes.content} ->> 'title') COLLATE pg_catalog.pg_unicode_fast)`
			),
	},
	(table) => [
		index('recipes_search_vector_idx').using('gin', table.searchVector),
		index('recipes_tag_keys_idx').using('gin', table.tagKeys),
	]
);
