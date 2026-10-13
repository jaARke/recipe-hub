ALTER TABLE "users" ADD COLUMN "removed_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "recipes_contributor_id_idx" ON "recipes" USING btree ("contributor_id");