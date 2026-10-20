-- Nothing calls search_keys once tag_keys, the one column it computed, is gone.
DROP FUNCTION public.search_keys(text[]);
