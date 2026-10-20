import { sql, type SQL } from 'drizzle-orm';
import {
	bigint,
	boolean,
	check,
	customType,
	index,
	integer,
	jsonb,
	numeric,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uuid,
	type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { chapters } from '@/domain/recipe/chapter';
import { diets } from '@/domain/recipe/diet';
import { holidays } from '@/domain/recipe/holiday';

// English stemming that ignores accents, shared by the search vector and every text search query.
export const recipeSearchConfiguration = sql.raw(`'public.recipe_english'::regconfig`);

const tsvector = customType<{ data: string }>({
	dataType() {
		return 'tsvector';
	},
});

// Inlined, since a check constraint's definition cannot take parameters.
function textLiterals(values: readonly string[]): SQL {
	return sql
		.join(
			values.map((value) => sql`${value}`),
			sql`, `
		)
		.inlineParams();
}

// The slugs of the chapter, holidays and diets a recipe is filed under, as words for search.
function filingWords(): SQL {
	return sql`public.immutable_array_to_string(array[${recipes.chapter}] || ${recipes.holidays} || ${recipes.diets}, ' ')`;
}

export const recipes = pgTable(
	'recipes',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		slug: text('slug').notNull().unique(),
		// No cascade: removing a member must not remove their recipes.
		contributorId: uuid('contributor_id')
			.notNull()
			.references(() => users.id),
		// The JSON columns are untyped because the mapper validates every read. Content excludes the
		// tags, chapter, holidays and diets, which have columns of their own.
		content: jsonb('content').notNull(),
		provenance: jsonb('provenance').notNull(),
		// The import the recipe was saved from. Unique, so an import saves one recipe.
		importId: uuid('import_id')
			.unique()
			.references(() => recipeImports.id),
		tags: text('tags').array().notNull().default([]),
		// Inserts that name no chapter, as the previous deployment's do, land in This & That.
		chapter: text('chapter', { enum: chapters }).notNull().default('this-and-that'),
		holidays: text('holidays', { enum: holidays }).array().notNull().default([]),
		diets: text('diets', { enum: diets }).array().notNull().default([]),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
		// Postgres derives the columns below from the content for search, and recipe reads leave them out.
		searchVector: tsvector('search_vector')
			.notNull()
			.generatedAlwaysAs(
				(): SQL =>
					sql`setweight(to_tsvector(${recipeSearchConfiguration}, ${recipes.content} ->> 'title'), 'A')
	|| setweight(to_tsvector(${recipeSearchConfiguration}, jsonb_path_query_array(${recipes.content}, '$.ingredientSections[*].lines[*].item')), 'B')
	|| setweight(to_tsvector(${recipeSearchConfiguration}, ${filingWords()}), 'B')
	|| setweight(to_tsvector(${recipeSearchConfiguration}, jsonb_path_query_array(${recipes.content}, '$.description') || jsonb_path_query_array(${recipes.content}, '$.notes') || jsonb_path_query_array(${recipes.content}, '$.source')), 'C')
	|| setweight(to_tsvector(${recipeSearchConfiguration}, jsonb_path_query_array(${recipes.content}, '$.instructionSections[*].steps[*].text')), 'D')`
			),
		// The words close matches compare: the title, ingredient items, and the filing's slugs.
		searchWords: text('search_words')
			.notNull()
			.generatedAlwaysAs(
				(): SQL =>
					sql`lower(public.immutable_unaccent((${recipes.content} ->> 'title') || ' ' || jsonb_path_query_array(${recipes.content}, '$.ingredientSections[*].lines[*].item')::text || ' ' || ${filingWords()}))`
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
		// Serves the contributor filter and its facet.
		index('recipes_contributor_id_idx').on(table.contributorId),
		// Serve the chapter, holiday and diet filters and their facets.
		index('recipes_chapter_idx').on(table.chapter),
		index('recipes_holidays_idx').using('gin', table.holidays),
		index('recipes_diets_idx').using('gin', table.diets),
		check('recipes_chapter_check', sql`${table.chapter} in (${textLiterals(chapters)})`),
		check('recipes_holidays_check', sql`${table.holidays} <@ array[${textLiterals(holidays)}]`),
		check('recipes_diets_check', sql`${table.diets} <@ array[${textLiterals(diets)}]`),
	]
);

// Slugs a recipe was renamed from, which keep finding it and which no other recipe takes.
export const oldRecipeSlugs = pgTable(
	'old_recipe_slugs',
	{
		slug: text('slug').primaryKey(),
		recipeId: uuid('recipe_id')
			.notNull()
			.references(() => recipes.id, { onDelete: 'cascade' }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [index('old_recipe_slugs_recipe_id_idx').on(table.recipeId)]
);

// Every import a member starts, kept as a record of use and cost once its draft is cleared.
export const recipeImports = pgTable(
	'recipe_imports',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		// No cascade, as for recipes: removing a member must not remove the record of their imports.
		memberId: uuid('member_id')
			.notNull()
			.references(() => users.id),
		mode: text('mode', { enum: ['url', 'photo'] }).notNull(),
		status: text('status', { enum: ['running', 'succeeded', 'failed'] })
			.notNull()
			.default('running'),
		sourceUrl: text('source_url'),
		aiModel: text('ai_model'),
		costUsd: numeric('cost_usd', { mode: 'number' }),
		// The code of the error that ended a failed import.
		failure: text('failure'),
		// Untyped, like the recipe documents, because the mapper validates every read.
		draft: jsonb('draft'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		check('recipe_imports_mode_check', sql`${table.mode} in ('url', 'photo')`),
		check(
			'recipe_imports_status_check',
			sql`${table.status} in ('running', 'succeeded', 'failed')`
		),
		// Serves the count of a member's recent imports and the list of their drafts.
		index('recipe_imports_member_id_created_at_idx').on(table.memberId, table.createdAt),
	]
);

// The drafts members save from the recipe form, each kept for a while after its last save. An
// import's own draft lives on its record in recipe_imports; a draft here that continues an import's
// review names the import.
export const recipeDrafts = pgTable(
	'recipe_drafts',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		memberId: uuid('member_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		// Unique, so an import has at most one draft.
		importId: uuid('import_id')
			.unique()
			.references(() => recipeImports.id, { onDelete: 'set null' }),
		// The provenance of the import the draft continues, which outlasts the import's own source URL;
		// null for a draft entered by hand. Untyped, as the recipes' is, because the mapper validates it.
		provenance: jsonb('provenance'),
		// What the member's list of drafts names it by; null while the recipe has no title.
		title: text('title'),
		// The recipe form's values, untyped because only the form reads them, and checks them as it does.
		values: jsonb('values').notNull(),
		// The images the values name, which the image sweep keeps while the draft lasts.
		imagePathnames: text('image_pathnames').array().notNull().default([]),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		// When it was last saved, from which it expires.
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	// Serves a member's list of drafts, newest first.
	(table) => [index('recipe_drafts_member_id_updated_at_idx').on(table.memberId, table.updatedAt)]
);

// The recipes each member keeps as favorites. Users are never deleted, so a member's removal deletes
// theirs itself.
export const favorites = pgTable(
	'favorites',
	{
		memberId: uuid('member_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		recipeId: uuid('recipe_id')
			.notNull()
			.references(() => recipes.id, { onDelete: 'cascade' }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		primaryKey({ columns: [table.memberId, table.recipeId] }),
		// Serves the cascade when a recipe is deleted, which the key, led by the member, cannot.
		index('favorites_recipe_id_idx').on(table.recipeId),
	]
);

// Better Auth reads the tables below by their JS keys, so the keys keep its field names. Its
// user name maps to displayName.

export const users = pgTable(
	'users',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		displayName: text('display_name').notNull(),
		email: text('email').notNull().unique(),
		emailVerified: boolean('email_verified').notNull().default(false),
		image: text('image'),
		role: text('role', { enum: ['member', 'admin'] })
			.notNull()
			.default('member'),
		// The invite that created the account. Unique, so an invite creates one account.
		inviteId: uuid('invite_id')
			.unique()
			.references((): AnyPgColumn => invites.id),
		// Set when an admin removes the member, whose email then becomes removedMemberEmail's address.
		// The row stays, so their recipes keep naming them.
		removedAt: timestamp('removed_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [check('users_role_check', sql`${table.role} in ('member', 'admin')`)]
);

export const sessions = pgTable(
	'sessions',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		token: text('token').notNull().unique(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
		ipAddress: text('ip_address'),
		userAgent: text('user_agent'),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
	},
	(table) => [index('sessions_user_id_idx').on(table.userId)]
);

// Better Auth requires the table; passkeys and email codes never write to it.
export const accounts = pgTable(
	'accounts',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		accountId: text('account_id').notNull(),
		providerId: text('provider_id').notNull(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		accessToken: text('access_token'),
		refreshToken: text('refresh_token'),
		idToken: text('id_token'),
		accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
		refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
		scope: text('scope'),
		password: text('password'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [index('accounts_user_id_idx').on(table.userId)]
);

export const verifications = pgTable(
	'verifications',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		identifier: text('identifier').notNull(),
		value: text('value').notNull(),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [index('verifications_identifier_idx').on(table.identifier)]
);

export const passkeys = pgTable(
	'passkeys',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		name: text('name'),
		publicKey: text('public_key').notNull(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		credentialID: text('credential_id').notNull().unique(),
		counter: integer('counter').notNull(),
		deviceType: text('device_type').notNull(),
		backedUp: boolean('backed_up').notNull(),
		transports: text('transports'),
		createdAt: timestamp('created_at', { withTimezone: true }),
		aaguid: text('aaguid'),
	},
	(table) => [index('passkeys_user_id_idx').on(table.userId)]
);

export const rateLimits = pgTable('rate_limits', {
	id: uuid('id')
		.primaryKey()
		.default(sql`uuidv7()`),
	key: text('key').notNull().unique(),
	count: integer('count').notNull(),
	lastRequest: bigint('last_request', { mode: 'number' }).notNull(),
});

export const accessRequests = pgTable(
	'access_requests',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		name: text('name').notNull(),
		relationship: text('relationship').notNull(),
		email: text('email'),
		status: text('status', { enum: ['pending', 'approved'] })
			.notNull()
			.default('pending'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		check('access_requests_status_check', sql`${table.status} in ('pending', 'approved')`),
	]
);

// An invite is accepted when an account's invite_id points at it.
export const invites = pgTable(
	'invites',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		tokenHash: text('token_hash').notNull().unique(),
		// Declining deletes the request, even when an invite whose approval failed still names it.
		requestId: uuid('request_id').references(() => accessRequests.id, { onDelete: 'set null' }),
		displayName: text('display_name').notNull(),
		role: text('role', { enum: ['member', 'admin'] }).notNull(),
		email: text('email'),
		createdBy: uuid('created_by')
			.notNull()
			.references(() => users.id),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		revokedAt: timestamp('revoked_at', { withTimezone: true }),
	},
	(table) => [check('invites_role_check', sql`${table.role} in ('member', 'admin')`)]
);
