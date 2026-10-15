CREATE TABLE "recipe_drafts" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"member_id" uuid NOT NULL,
	"import_id" uuid,
	"title" text,
	"values" jsonb NOT NULL,
	"image_pathnames" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recipe_drafts_import_id_unique" UNIQUE("import_id")
);
--> statement-breakpoint
ALTER TABLE "recipe_drafts" ADD CONSTRAINT "recipe_drafts_member_id_users_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_drafts" ADD CONSTRAINT "recipe_drafts_import_id_recipe_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."recipe_imports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recipe_drafts_member_id_updated_at_idx" ON "recipe_drafts" USING btree ("member_id","updated_at");