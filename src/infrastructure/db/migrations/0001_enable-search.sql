-- Extensions, immutable helpers, and the text search configuration that the search columns use.
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;--> statement-breakpoint
CREATE FUNCTION public.immutable_unaccent(text) RETURNS text
	LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
	RETURN public.unaccent('public.unaccent'::regdictionary, $1);--> statement-breakpoint
CREATE FUNCTION public.immutable_array_to_string(text[], text) RETURNS text
	LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
	RETURN pg_catalog.array_to_string($1, $2);--> statement-breakpoint
CREATE FUNCTION public.search_key(text) RETURNS text
	LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
	RETURN pg_catalog.lower($1 COLLATE pg_catalog.pg_unicode_fast);--> statement-breakpoint
CREATE FUNCTION public.search_keys(text[]) RETURNS text[]
	LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
	RETURN ARRAY(
		SELECT public.search_key(element)
		FROM pg_catalog.unnest($1) WITH ORDINALITY AS elements(element, position)
		ORDER BY position
	);--> statement-breakpoint
CREATE TEXT SEARCH CONFIGURATION public.recipe_english (COPY = pg_catalog.english);--> statement-breakpoint
ALTER TEXT SEARCH CONFIGURATION public.recipe_english
	ALTER MAPPING FOR word, hword, hword_part WITH public.unaccent, pg_catalog.english_stem;--> statement-breakpoint
ALTER TEXT SEARCH CONFIGURATION public.recipe_english
	ALTER MAPPING FOR numword, numhword, hword_numpart WITH public.unaccent, pg_catalog.simple;
