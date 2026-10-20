-- Changing search_vector's expression dropped the column and its index, which the schema still declares.
CREATE INDEX "recipes_search_vector_idx" ON "recipes" USING gin ("search_vector");
