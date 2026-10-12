CREATE TABLE "old_recipe_slugs" (
	"slug" text PRIMARY KEY NOT NULL,
	"recipe_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "old_recipe_slugs" ADD CONSTRAINT "old_recipe_slugs_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "old_recipe_slugs_recipe_id_idx" ON "old_recipe_slugs" USING btree ("recipe_id");