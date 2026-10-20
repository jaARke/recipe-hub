ALTER TABLE "recipe_drafts" ALTER COLUMN "values" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "recipe_drafts" ADD COLUMN "imported" jsonb;--> statement-breakpoint
ALTER TABLE "recipe_drafts" ADD CONSTRAINT "recipe_drafts_contents_check" CHECK ("recipe_drafts"."values" is not null or "recipe_drafts"."imported" is not null);